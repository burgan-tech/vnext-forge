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
  type DomainEnvInfo,
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

/**
 * Loopback either answers at once or is not listening, so this only has to
 * cover scheduling jitter. Kept short because a full offset scan performs up
 * to 105 connect probes.
 */
const PORT_CONNECT_PROBE_TIMEOUT_MS = 250;

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
    // This is the Retry entry point, so drop the memoised runtime before
    // re-detecting. `createToolLookup` deliberately never caches a *failed*
    // lookup so that "Docker not found -> install Docker -> Retry" genuinely
    // re-checks; caching the runtime here would defeat that for the container
    // CLI specifically. Not a redundant reset — do not optimise it away.
    this.runtimeInfo = undefined;

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

  /** True when `port` can be bound on `host` — false means something conflicts. */
  private bindProbe(port: number, host: string): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, host);
    });
  }

  /** True when something accepts a loopback connection on `port`. */
  private connectProbe(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' });
      const settle = (listening: boolean): void => {
        socket.destroy();
        resolve(listening);
      };
      socket.setTimeout(PORT_CONNECT_PROBE_TIMEOUT_MS);
      socket.once('connect', () => settle(true));
      socket.once('error', () => settle(false));
      // A port that never answers counts as "nothing listening". Treating a
      // timeout as in-use would be safer in isolation, but `suggestPortOffset`
      // probes up to 21 offsets x 5 ports, so one black-holed or firewalled
      // port must not be able to stall the whole scan.
      socket.once('timeout', () => settle(false));
    });
  }

  /**
   * True when nothing is listening on `port`.
   *
   * All three probes are required. This is verified behaviour, not caution —
   * measured on macOS with a real listener on the port:
   *
   * | listener bound on | bind 127.0.0.1 | bind 0.0.0.0 | connect |
   * |-------------------|----------------|--------------|---------|
   * | 0.0.0.0           | "free" (wrong) | in use       | in use  |
   * | 127.0.0.1         | in use         | "free"(wrong)| in use  |
   * | nothing           | free           | free         | free    |
   *
   * Each bind probe alone has a blind spot, in opposite directions. The cause
   * is `SO_REUSEADDR`, which Node sets on every listener: under BSD semantics
   * that permits binding a *specific* address while a wildcard socket already
   * holds the port, so a `127.0.0.1` bind succeeds against a container
   * published on `0.0.0.0` — which is exactly docker's default for
   * `-p 4201:4201`, and exactly the collision this probe exists to catch.
   * Linux additionally requires the existing socket to have set `SO_REUSEADDR`,
   * so the bind probes are not merely incomplete but platform-dependent.
   *
   * The stakes are why this is thorough: the runtime clone lives inside the
   * workspace, so a second workspace's clone cannot see the first clone's
   * `domains/` directory. Port probing is the only defence against two
   * runtimes claiming one offset, and the UI presents the result as a checked
   * suggestion — a blind probe would be worse than no probe at all.
   *
   * If you are here to delete two of these: re-run the table above first.
   */
  async isPortFree(port: number): Promise<boolean> {
    if (!(await this.bindProbe(port, '127.0.0.1'))) return false;
    if (!(await this.bindProbe(port, '0.0.0.0'))) return false;
    return !(await this.connectProbe(port));
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

  /**
   * Whether the shared infrastructure (vnext-postgres) is already running.
   *
   * Two accepted imprecisions, both consequences of the collision-defence
   * design rather than oversights:
   *
   * 1. `vnext-postgres` is a *proxy* for the whole infra profile. If a
   *    cancelled `make up-infra` left postgres up but redis or vault down, a
   *    retry skips infra entirely and the domain fails later against the
   *    missing dependency.
   * 2. `\bUp\b` also matches `Up 2 minutes (unhealthy)`, so a running-but-
   *    unhealthy postgres reads as running. Accepted because `up-infra` would
   *    not repair an unhealthy container anyway.
   *
   * Both are preferable to the alternative: postgres is fixed at 5432 and is
   * not offset-aware, so a second workspace's clone must never start infra
   * that is already up.
   */
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
    //
    // Gated on a marker *inside* the clone, not on the directory itself. A
    // `git clone` interrupted by Cancel usually removes its own target, but
    // when that cleanup loses the race it leaves a directory with no Makefile
    // — and gating on mere existence would then skip the clone on every later
    // run and die at `make setup` with "no makefile found", escapable only by
    // deleting a hidden directory by hand.
    const cloneMarker = path.join(runtimePath, 'Makefile');
    const cloneDirExists = await this.pathExists(runtimePath);
    const cloneIntact = cloneDirExists && (await this.pathExists(cloneMarker));

    if (cloneIntact) {
      this.log(`Runtime clone already present at ${runtimePath}; skipping clone.`);
    } else {
      if (cloneDirExists) {
        // The only destructive operation in this feature. It is reachable
        // *only* when the directory exists AND the Makefile does not, i.e. a
        // provably incomplete clone — never when the clone is intact.
        // `git clone` refuses a non-empty target, so the leftovers must go.
        this.log(
          `${runtimePath} exists but has no Makefile, so the previous clone did not finish. Removing it and cloning again.`,
        );
        await fs.rm(runtimePath, { recursive: true, force: true });
      }
      progress.report({ message: 'Cloning the vNext runtime…' });
      await this.step('Cloning the runtime', git, cloneArgv(), params.workspacePath, token);
    }

    // 2 — gitignore
    await ensureGitignoreEntry(params.workspacePath, `${VNEXT_RUNTIME_DIR_NAME}/`);

    // 3 — setup
    progress.report({ message: 'Preparing the runtime environment…' });
    await this.step('make setup', make, makeArgv('setup'), runtimePath, token);

    // 4 — domain configuration
    //
    // Only a *successfully parsed* `.env` takes the reuse path; both a missing
    // file and an unparseable one fall through to create-domain. An `.env`
    // truncated by a cancelled run has no usable PORT_OFFSET, and previously
    // matched neither branch — leaving the domain unprovisioned forever, with
    // no error and nothing in the log to say so.
    let portOffset = params.portOffset;
    const domainEnvPath = path.join(domainDir, '.env');

    let envContent: string | null = null;
    try {
      envContent = await fs.readFile(domainEnvPath, 'utf-8');
    } catch {
      // No domain configuration yet — handled below.
    }
    const existingEnv: DomainEnvInfo | null =
      envContent === null ? null : parseDomainEnv(envContent);

    if (existingEnv !== null) {
      portOffset = existingEnv.portOffset;
      this.log(`Domain "${params.domain}" already configured at offset ${portOffset}; reusing it.`);
    } else {
      this.log(
        envContent === null
          ? `Domain "${params.domain}" is not configured yet; running create-domain at offset ${portOffset}.`
          : `${domainEnvPath} has no usable PORT_OFFSET, so the previous create-domain did not finish. Re-running it at offset ${portOffset}.`,
      );
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
