import { execFile } from 'node:child_process'
import path from 'node:path'

import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

import { buildChildEnv, DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST } from '../../lib/child-env.js'
import type { PathPolicy } from '../../internal/path-policy.js'
import {
  CLI_EXECUTE_DEFAULT_TIMEOUT_MS,
  CLI_EXECUTE_MAX_TIMEOUT_MS,
  type CliAllowedCommand,
} from './cli-schemas.js'
import { compareCoreSemver, extractCoreSemver } from './semver.js'
import { buildWfArgv, wfSupportsDomainFlag, type WfCommandSpec } from './wf-argv.js'

const NPM_WORKFLOW_CLI_PACKAGE = '@burgan-tech/vnext-workflow-cli'
const NPM_REGISTRY_CLI_URL = `https://registry.npmjs.org/${encodeURIComponent(NPM_WORKFLOW_CLI_PACKAGE)}`
const REGISTRY_FETCH_TIMEOUT_MS = 15_000
const NPM_UPDATE_GLOBAL_TIMEOUT_MS = 120_000

interface NpmDistTagsPayload {
  'dist-tags'?: { latest?: string }
}

async function fetchLatestNpmVersion(): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REGISTRY_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(NPM_REGISTRY_CLI_URL, {
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (!res.ok) {
      return null
    }
    const json = (await res.json()) as NpmDistTagsPayload
    const latest = json['dist-tags']?.latest
    const trimmed = typeof latest === 'string' ? latest.trim() : ''
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface CliCheckResult {
  available: boolean
  version?: string
  /** Installed CLI understands the global `--domain` option (≥ 1.0.13). */
  supportsDomainFlag: boolean
}

export interface CliService {
  checkCliAvailable(): Promise<CliCheckResult>
  checkForUpdate(): Promise<{ installed: string | null; latest: string | null; updateAvailable: boolean }>
  updateGlobal(traceId?: string): Promise<{ exitCode: number; stdout: string; stderr: string }>
  executeCommand(
    params: {
      command: CliAllowedCommand
      projectPath: string
      filePath?: string
      /**
       * Restrict the run to one solution. With a CLI ≥ 1.0.13 this becomes
       * `--domain <name>`; older CLIs get the legacy `wf domain use <name>`
       * first (which also rewrites the CLI's active profile).
       */
      domain?: string
      timeoutMs?: number
    },
    traceId?: string,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>
  domainAdd(
    params: {
      domainName: string
      apiBaseUrl: string
      dbName: string
      dbHost?: string
      dbPort?: number
      dbUser?: string
      dbPassword?: string
      useDocker?: boolean
      dockerPostgresContainer?: string
      timeoutMs?: number
    },
    traceId?: string,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>
  /**
   * The `wf domain` read/lifecycle verbs.
   *
   * Deliberately *not* registered as dispatchable methods: they exist for
   * in-process use by the extension host (see `wf-domain-registrar`), and
   * registering them would widen the HTTP surface with domain mutation for
   * no caller that needs it.
   *
   * Every `wf domain` subcommand exits 0 even on error, so callers must read
   * the output (`parseWfDomainList`) rather than trusting `exitCode`.
   */
  domainList(timeoutMs?: number): Promise<{ exitCode: number; stdout: string; stderr: string }>
  domainRemove(
    name: string,
    timeoutMs?: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>
  domainUse(
    name: string,
    timeoutMs?: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>
}

export interface CliServiceDeps {
  pathPolicy?: PathPolicy
}

const WF_BINARY = 'wf'

const WINDOWS = process.platform === 'win32'

type ExecFileOpts = {
  cwd: string
  timeout: number
  encoding: BufferEncoding
  shell: boolean
  env: NodeJS.ProcessEnv
}

function execFileOptions(cwd: string, timeoutMs: number): ExecFileOpts {
  return {
    cwd,
    timeout: timeoutMs,
    encoding: 'utf8',
    shell: WINDOWS,
    env: buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST),
  }
}

function npmGlobalExecOptions(cwd: string, timeoutMs: number): ExecFileOpts {
  return {
    cwd,
    timeout: timeoutMs,
    encoding: 'utf8',
    shell: false,
    env: buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST),
  }
}

function toWfCommandSpec(command: CliAllowedCommand, resolvedFilePath?: string): WfCommandSpec {
  if (command === 'update -f') {
    if (!resolvedFilePath || resolvedFilePath.length === 0) {
      throw new VnextForgeError(
        ERROR_CODES.FILE_INVALID_PATH,
        'filePath is required for update -f.',
        { source: 'CliService.toWfCommandSpec', layer: 'application' },
      )
    }
    return { base: 'update -f', filePath: resolvedFilePath }
  }
  return { base: command }
}

function clampTimeout(timeoutMs?: number): number {
  if (timeoutMs === undefined || Number.isNaN(timeoutMs)) {
    return CLI_EXECUTE_DEFAULT_TIMEOUT_MS
  }
  return Math.min(Math.max(1, timeoutMs), CLI_EXECUTE_MAX_TIMEOUT_MS)
}

/**
 * Only forward what the caller actually knows; unspecified options are
 * inherited from the CLI's default domain.
 */
export function buildDomainAddArgv(params: {
  domainName: string
  apiBaseUrl: string
  dbName: string
  dbHost?: string
  dbPort?: number
  dbUser?: string
  dbPassword?: string
  useDocker?: boolean
  dockerPostgresContainer?: string
}): string[] {
  const argv = [
    'domain', 'add', params.domainName,
    '--API_BASE_URL', params.apiBaseUrl,
    '--DB_NAME', params.dbName,
  ]
  if (params.dbHost !== undefined) argv.push('--DB_HOST', params.dbHost)
  if (params.dbPort !== undefined) argv.push('--DB_PORT', String(params.dbPort))
  if (params.dbUser !== undefined) argv.push('--DB_USER', params.dbUser)
  if (params.dbPassword !== undefined) argv.push('--DB_PASSWORD', params.dbPassword)
  if (params.useDocker !== undefined) argv.push('--USE_DOCKER', String(params.useDocker))
  if (params.dockerPostgresContainer !== undefined) {
    argv.push('--DOCKER_POSTGRES_CONTAINER', params.dockerPostgresContainer)
  }
  return argv
}

export function buildDomainListArgv(): string[] {
  return ['domain', 'list']
}

export function buildDomainRemoveArgv(name: string): string[] {
  return ['domain', 'remove', name]
}

export function buildDomainUseArgv(name: string): string[] {
  return ['domain', 'use', name]
}

/**
 * Normalize and ensure `candidate` resolves under `projectRoot` (no traversal).
 */
async function resolveFileInsideProject(params: {
  projectRoot: string
  candidate: string
  pathPolicy?: PathPolicy
  traceId?: string
}): Promise<string> {
  const rootNorm = path.normalize(params.projectRoot)
  const trimmed = params.candidate.trim()
  const resolved = path.normalize(
    path.isAbsolute(trimmed) ? trimmed : path.join(rootNorm, trimmed),
  )
  const rel = path.relative(rootNorm, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new VnextForgeError(
      ERROR_CODES.FILE_PERMISSION_DENIED,
      'filePath escapes the project root.',
      {
        source: 'CliService.resolveFileInsideProject',
        layer: 'application',
        details: { projectRoot: rootNorm, filePath: trimmed },
      },
      params.traceId,
    )
  }
  if (params.pathPolicy) {
    await params.pathPolicy.assertReadable(resolved, params.traceId)
  }
  return resolved
}

function runExecFile(file: string, args: readonly string[], options: ExecFileOpts): Promise<{
  exitCode: number
  stdout: string
  stderr: string
}> {
  return new Promise((resolve) => {
    execFile(file, args as string[], options, (error, stdout, stderr) => {
      const out = stdout === undefined || stdout === null ? '' : String(stdout as string | Buffer)
      const errStr = stderr === undefined || stderr === null ? '' : String(stderr as string | Buffer)
      if (error) {
        const err = error as NodeJS.ErrnoException & { code?: string | number | undefined }
        const exitCode = typeof err.code === 'number' ? err.code : 1
        resolve({ exitCode, stdout: out, stderr: errStr || err.message })
        return
      }
      resolve({ exitCode: 0, stdout: out, stderr: errStr })
    })
  })
}

export function createCliService(deps: CliServiceDeps = {}): CliService {
  const { pathPolicy } = deps

  // `wf --version` is probed once per process and after every global update;
  // a missing CLI is not memoized so an install made mid-session is picked up.
  let versionProbe: Promise<CliCheckResult> | undefined

  async function probeCli(): Promise<CliCheckResult> {
    const opts = execFileOptions(process.cwd(), 10_000)
    const result = await runExecFile(WF_BINARY, ['--version'], opts)
    if (result.exitCode !== 0) {
      return { available: false, supportsDomainFlag: false }
    }
    const versionLine = result.stdout.trim()
    return {
      available: true,
      ...(versionLine.length > 0 ? { version: versionLine } : {}),
      supportsDomainFlag: wfSupportsDomainFlag(versionLine),
    }
  }

  function checkCliAvailableMemo(): Promise<CliCheckResult> {
    versionProbe ??= probeCli().then((info) => {
      if (!info.available) versionProbe = undefined
      return info
    })
    return versionProbe
  }

  return {
    checkCliAvailable(): Promise<CliCheckResult> {
      return checkCliAvailableMemo()
    },

    async checkForUpdate(): Promise<{ installed: string | null; latest: string | null; updateAvailable: boolean }> {
      const avail = await this.checkCliAvailable()
      let installed: string | null = null
      if (avail.available && avail.version) {
        installed = extractCoreSemver(avail.version) ?? (avail.version.trim().length > 0 ? avail.version.trim() : null)
      }

      const latest = await fetchLatestNpmVersion()
      const latestCore =
        latest !== null ? extractCoreSemver(latest) ?? latest.trim() : null
      let updateAvailable = false
      if (installed !== null && latestCore !== null) {
        updateAvailable = compareCoreSemver(latestCore, installed) > 0
      }

      return { installed, latest, updateAvailable }
    },

    async updateGlobal(_traceId): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      const opts = npmGlobalExecOptions(process.cwd(), NPM_UPDATE_GLOBAL_TIMEOUT_MS)
      const npmExecutable = WINDOWS ? 'npm.cmd' : 'npm'
      const result = await runExecFile(npmExecutable, ['install', '-g', `${NPM_WORKFLOW_CLI_PACKAGE}@latest`], opts)
      versionProbe = undefined
      return result
    },

    async executeCommand(params, traceId): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      const timeoutMs = clampTimeout(params.timeoutMs)
      const trimmedRoot = params.projectPath.trim()
      if (!trimmedRoot) {
        throw new VnextForgeError(
          ERROR_CODES.FILE_INVALID_PATH,
          'projectPath must be non-empty.',
          {
            source: 'CliService.executeCommand',
            layer: 'application',
          },
          traceId,
        )
      }
      const projectRootNorm = path.normalize(trimmedRoot)
      if (pathPolicy) {
        await pathPolicy.assertReadable(projectRootNorm, traceId)
      }

      let resolvedFileArg: string | undefined
      if (params.command === 'update -f') {
        const raw = params.filePath?.trim() ?? ''
        resolvedFileArg = await resolveFileInsideProject({
          projectRoot: projectRootNorm,
          candidate: raw,
          pathPolicy,
          traceId,
        })
      }

      const spec = toWfCommandSpec(params.command, resolvedFileArg)
      const domain = params.domain?.trim()
      const execOpts = execFileOptions(projectRootNorm, timeoutMs)

      if (!domain) {
        return runExecFile(WF_BINARY, buildWfArgv(spec), execOpts)
      }

      const info = await checkCliAvailableMemo()
      if (info.supportsDomainFlag) {
        return runExecFile(WF_BINARY, buildWfArgv(spec, { domain }), execOpts)
      }

      // Legacy CLI: no `--domain`; select the profile first. Same semantics as
      // the extension's terminal fallback (`wf domain use X && wf …`).
      const use = await runExecFile(WF_BINARY, buildDomainUseArgv(domain), execOpts)
      if (use.exitCode !== 0) return use
      return runExecFile(WF_BINARY, buildWfArgv(spec), execOpts)
    },

    async domainAdd(params, _traceId): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      const timeoutMs = clampTimeout(params.timeoutMs)
      const argv = buildDomainAddArgv(params)
      const execOpts = execFileOptions(process.cwd(), timeoutMs)
      return runExecFile(WF_BINARY, argv, execOpts)
    },

    async domainList(timeoutMs): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      const execOpts = execFileOptions(process.cwd(), clampTimeout(timeoutMs))
      return runExecFile(WF_BINARY, buildDomainListArgv(), execOpts)
    },

    async domainRemove(name, timeoutMs): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      const execOpts = execFileOptions(process.cwd(), clampTimeout(timeoutMs))
      return runExecFile(WF_BINARY, buildDomainRemoveArgv(name), execOpts)
    },

    async domainUse(name, timeoutMs): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      const execOpts = execFileOptions(process.cwd(), clampTimeout(timeoutMs))
      return runExecFile(WF_BINARY, buildDomainUseArgv(name), execOpts)
    },
  }
}
