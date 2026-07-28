import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as path from 'node:path';

import type * as vscode from 'vscode';
import {
  cloneArgv,
  computeDomainPorts,
  containerInfoArgv,
  containerPsArgv,
  detectContainerRuntime,
  evaluatePreflight,
  extractDbNameFromAppSettings,
  findFreePortOffset,
  makeArgv,
  normalizeDbName,
  parseDomainEnv,
  PORT_OFFSET_STEP,
  RUNTIME_POSTGRES,
  VNEXT_RUNTIME_DIR_NAME,
  type ContainerRuntimeDetection,
  type ContainerRuntimeInfo,
  type PreflightResult,
} from '@vnext-forge-studio/services-core';
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts';

import type { LocalRuntimeBinding } from '../forge-tools-settings.js';
import { createToolLookup } from './tool-lookup.js';
import { ensureGitignoreEntry } from './gitignore-writer.js';
import { runStreaming } from './process-runner.js';

export type ContainerState = 'running' | 'stopped' | 'absent';

export interface ProvisionParams {
  workspacePath: string;
  domain: string;
  portOffset: number;
}

export interface ProvisionResult {
  binding: LocalRuntimeBinding;
  baseUrl: string;
  dbName: string;
  healthy: boolean;
}

const HEALTH_POLL_INTERVAL_MS = 3_000;
const HEALTH_TIMEOUT_MS = 90_000;

export class LocalRuntimeService {
  private readonly lookup = createToolLookup();
  private runtimeInfo: ContainerRuntimeInfo | undefined;

  constructor(private readonly output: vscode.OutputChannel) {}

  private log(line: string): void {
    this.output.appendLine(line);
  }

  /**
   * `docker compose version` (or `podman compose version`) exits 0 only when
   * the subcommand actually exists — that is the probe the pure detector needs.
   */
  private readonly composeProbe = (argv: string[]): boolean => {
    const bin = this.lookup(argv[0] ?? '');
    if (bin === null) return false;
    const probe = spawnSync(bin, [...argv.slice(1), 'version'], { encoding: 'utf8' });
    return probe.status === 0;
  };

  private detect(): ContainerRuntimeDetection {
    return detectContainerRuntime(this.lookup, this.composeProbe);
  }

  /** Resolve the container CLI once; callers re-detect after a stale-path failure. */
  private resolveRuntime(): ContainerRuntimeInfo | null {
    if (this.runtimeInfo) return this.runtimeInfo;
    const detection = this.detect();
    if (!detection.ok) return null;
    this.runtimeInfo = detection.info;
    return this.runtimeInfo;
  }

  async detectPreflight(): Promise<PreflightResult> {
    const runtimeDetection = this.detect();

    let daemonReachable: boolean | null = null;
    if (runtimeDetection.ok) {
      const result = await runStreaming(
        runtimeDetection.info.containerCli.path,
        containerInfoArgv(),
        { cwd: process.cwd(), onLine: () => { /* probe only — output discarded */ } },
      );
      daemonReachable = result.exitCode === 0;
    }

    return evaluatePreflight({
      git: this.lookup('git'),
      make: this.lookup('make'),
      runtime: runtimeDetection,
      daemonReachable,
    });
  }

  /** True when nothing is listening on `port`. */
  async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, '127.0.0.1');
    });
  }

  /** Offsets already recorded under the clone's `domains/` directory. */
  async readUsedOffsets(runtimePath: string): Promise<number[]> {
    const domainsDir = path.join(runtimePath, 'vnext', 'docker', 'domains');
    const offsets: number[] = [];
    let entries: string[];
    try {
      entries = await fs.readdir(domainsDir);
    } catch {
      return offsets;
    }
    for (const entry of entries) {
      try {
        const content = await fs.readFile(path.join(domainsDir, entry, '.env'), 'utf-8');
        const parsed = parseDomainEnv(content);
        if (parsed) offsets.push(parsed.portOffset);
      } catch {
        // Not a provisioned domain directory — ignore.
      }
    }
    return offsets;
  }

  /**
   * Suggest the first offset whose five host ports are all free. Probing real
   * ports (not just this clone's `domains/`) matters because the clone lives
   * inside the workspace: another workspace's clone may already own an offset.
   */
  async suggestPortOffset(workspacePath: string): Promise<number | null> {
    const runtimePath = path.join(workspacePath, VNEXT_RUNTIME_DIR_NAME);
    const usedOffsets = await this.readUsedOffsets(runtimePath);
    return findFreePortOffset({
      usedOffsets,
      isPortFree: (port) => this.isPortFree(port),
    });
  }

  static isValidPortOffset(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value % PORT_OFFSET_STEP === 0;
  }

  /** Run one step; a non-zero exit becomes a VnextForgeError. */
  private async step(
    label: string,
    file: string,
    argv: readonly string[],
    cwd: string,
    token: vscode.CancellationToken,
  ): Promise<void> {
    this.log(`\n$ ${path.basename(file)} ${argv.join(' ')}   (cwd: ${cwd})`);
    const result = await runStreaming(file, argv, {
      cwd,
      onLine: (line) => this.log(line),
      token,
    });
    if (result.cancelled) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_EXECUTION_FAILED,
        `${label} was cancelled.`,
        { source: 'LocalRuntimeService.step', layer: 'application' },
      );
    }
    if (result.exitCode !== 0) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_EXECUTION_FAILED,
        `${label} failed (exit ${result.exitCode}). See the vnext-forge-studio output for details.`,
        {
          source: 'LocalRuntimeService.step',
          layer: 'application',
          details: { label, exitCode: result.exitCode },
        },
      );
    }
  }

  private requireTool(bin: string): string {
    const resolved = this.lookup(bin);
    if (resolved === null) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_NOT_AVAILABLE,
        `${bin} could not be found. Install it and try again.`,
        { source: 'LocalRuntimeService.requireTool', layer: 'application' },
      );
    }
    return resolved;
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  /** Whether the shared infrastructure (vnext-postgres) is already running. */
  private async isInfraRunning(): Promise<boolean> {
    const runtime = this.resolveRuntime();
    if (!runtime) return false;
    const result = await runStreaming(
      runtime.containerCli.path,
      containerPsArgv(RUNTIME_POSTGRES.container),
      { cwd: process.cwd(), onLine: () => { /* probe only — output discarded */ } },
    );
    return result.exitCode === 0 && /\bUp\b/i.test(result.output);
  }

  private async waitForHealth(
    appPort: number,
    token: vscode.CancellationToken,
  ): Promise<boolean> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (token.isCancellationRequested) return false;
      try {
        const res = await fetch(`http://localhost:${appPort}/health`);
        if (res.ok) return true;
      } catch {
        // Not up yet.
      }
      await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
    }
    return false;
  }

  /**
   * Clone, configure and start a local runtime for `domain`.
   *
   * Every step is idempotent, so a cancelled or failed run can simply be
   * repeated: it picks up from whatever is already on disk.
   */
  async provision(
    params: ProvisionParams,
    progress: vscode.Progress<{ message?: string }>,
    token: vscode.CancellationToken,
  ): Promise<ProvisionResult> {
    const git = this.requireTool('git');
    const make = this.requireTool('make');
    const runtimePath = path.join(params.workspacePath, VNEXT_RUNTIME_DIR_NAME);
    const dockerDir = path.join(runtimePath, 'vnext', 'docker');
    const domainDir = path.join(dockerDir, 'domains', params.domain);

    // 1 — clone
    if (!(await this.pathExists(runtimePath))) {
      progress.report({ message: 'Cloning the vNext runtime…' });
      await this.step('Cloning the runtime', git, cloneArgv(), params.workspacePath, token);
    } else {
      this.log(`Runtime clone already present at ${runtimePath}; skipping clone.`);
    }

    // 2 — gitignore
    await ensureGitignoreEntry(params.workspacePath, `${VNEXT_RUNTIME_DIR_NAME}/`);

    // 3 — setup
    progress.report({ message: 'Preparing the runtime environment…' });
    await this.step('make setup', make, makeArgv('setup'), runtimePath, token);

    // 4 — domain configuration
    let portOffset = params.portOffset;
    const domainEnvPath = path.join(domainDir, '.env');
    if (await this.pathExists(domainEnvPath)) {
      const parsed = parseDomainEnv(await fs.readFile(domainEnvPath, 'utf-8'));
      if (parsed) {
        portOffset = parsed.portOffset;
        this.log(`Domain "${params.domain}" already configured at offset ${portOffset}; reusing it.`);
      }
    } else {
      progress.report({ message: `Creating domain configuration (offset ${portOffset})…` });
      await this.step(
        'make create-domain',
        make,
        makeArgv('create-domain', { domain: params.domain, portOffset }),
        runtimePath,
        token,
      );
    }
    const ports = computeDomainPorts(portOffset);

    // 5 — shared infrastructure
    if (await this.isInfraRunning()) {
      this.log('Shared infrastructure already running; skipping make up-infra.');
    } else {
      progress.report({ message: 'Starting shared infrastructure…' });
      await this.step('make up-infra', make, makeArgv('up-infra'), runtimePath, token);
    }

    // 6 — database
    progress.report({ message: 'Creating the domain database…' });
    await this.step(
      'make db-create',
      make,
      makeArgv('db-create', { domain: params.domain }),
      runtimePath,
      token,
    );

    // 7 — start
    progress.report({ message: 'Starting the runtime containers…' });
    await this.step(
      'make up-vnext',
      make,
      makeArgv('up-vnext', { domain: params.domain }),
      runtimePath,
      token,
    );

    // 8 — health
    progress.report({ message: 'Waiting for the runtime to report healthy…' });
    const healthy = await this.waitForHealth(ports.app, token);
    if (!healthy) {
      this.log(
        token.isCancellationRequested
          ? 'Cancelled while waiting for the runtime to report healthy; the containers are still running.'
          : `Runtime did not report healthy within ${HEALTH_TIMEOUT_MS / 1000}s.`,
      );
    }

    // DB name: trust the generated file over any recomputation.
    let dbName = normalizeDbName(params.domain) ?? `vNext_${params.domain}`;
    try {
      const appSettings = await fs.readFile(
        path.join(domainDir, 'appsettings.Development.json'),
        'utf-8',
      );
      dbName = extractDbNameFromAppSettings(appSettings) ?? dbName;
    } catch {
      this.log('Could not read the generated appsettings; falling back to the derived DB name.');
    }

    return {
      binding: {
        domain: params.domain,
        portOffset,
        runtimePath,
        workspacePath: params.workspacePath,
        ports,
      },
      baseUrl: `http://localhost:${ports.app}`,
      dbName,
      healthy,
    };
  }

  /** Values for `wf domain add` once provisioning has discovered them. */
  buildDomainAddArgs(binding: LocalRuntimeBinding, dbName: string) {
    return {
      domainName: binding.domain,
      apiBaseUrl: `http://localhost:${binding.ports.app}`,
      dbName,
      dbHost: RUNTIME_POSTGRES.host,
      dbPort: RUNTIME_POSTGRES.port,
      dbUser: RUNTIME_POSTGRES.user,
      dbPassword: RUNTIME_POSTGRES.password,
      useDocker: true,
      dockerPostgresContainer: RUNTIME_POSTGRES.container,
    };
  }
}
