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

const NPM_WORKFLOW_CLI_PACKAGE = '@burgan-tech/vnext-workflow-cli'
const NPM_REGISTRY_CLI_URL = `https://registry.npmjs.org/${encodeURIComponent(NPM_WORKFLOW_CLI_PACKAGE)}`
const REGISTRY_FETCH_TIMEOUT_MS = 15_000
const NPM_UPDATE_GLOBAL_TIMEOUT_MS = 120_000

interface NpmDistTagsPayload {
  'dist-tags'?: { latest?: string }
}

/** First core semver matched in a version string ("v1.2.3", "wf 2.0.0", …). */
function extractCoreSemver(raw: string): string | null {
  const trimmed = raw.trim()
  const m =
    /\bv?(\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?\b/.exec(trimmed) ??
    /\b(\d+\.\d+\.\d+)\b/.exec(trimmed)
  return m?.[1] ?? null
}

/** Compare two core semver strings (x.y.z). Returns positive if `a` is greater than `b`. */
function compareCoreSemver(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10))
  const pb = b.split('.').map((x) => Number.parseInt(x, 10))
  if (pa.length !== 3 || pb.length !== 3 || pa.some(Number.isNaN) || pb.some(Number.isNaN)) {
    return a.localeCompare(b)
  }
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) {
      return (pa[i] ?? 0) - (pb[i] ?? 0)
    }
  }
  return 0
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

export interface CliService {
  checkCliAvailable(): Promise<{ available: boolean; version?: string }>
  checkForUpdate(): Promise<{ installed: string | null; latest: string | null; updateAvailable: boolean }>
  updateGlobal(traceId?: string): Promise<{ exitCode: number; stdout: string; stderr: string }>
  executeCommand(
    params: {
      command: CliAllowedCommand
      projectPath: string
      filePath?: string
      timeoutMs?: number
    },
    traceId?: string,
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

function mapCommandToArgv(command: CliAllowedCommand, resolvedFilePath?: string): string[] {
  switch (command) {
    case 'check':
      return ['check']
    case 'update':
      return ['update']
    case 'update --all':
      return ['update', '--all']
    case 'update -f': {
      if (!resolvedFilePath || resolvedFilePath.length === 0) {
        throw new VnextForgeError(
          ERROR_CODES.FILE_INVALID_PATH,
          'filePath is required for update -f.',
          { source: 'CliService.mapCommandToArgv', layer: 'application' },
        )
      }
      return ['update', '-f', resolvedFilePath]
    }
    case 'csx --all':
      return ['csx', '--all']
    case 'sync':
      return ['sync']
    default: {
      const _never: never = command
      return _never
    }
  }
}

function clampTimeout(timeoutMs?: number): number {
  if (timeoutMs === undefined || Number.isNaN(timeoutMs)) {
    return CLI_EXECUTE_DEFAULT_TIMEOUT_MS
  }
  return Math.min(Math.max(1, timeoutMs), CLI_EXECUTE_MAX_TIMEOUT_MS)
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

  return {
    async checkCliAvailable(): Promise<{ available: boolean; version?: string }> {
      const opts = execFileOptions(process.cwd(), 10_000)
      const result = await runExecFile(WF_BINARY, ['--version'], opts)
      if (result.exitCode !== 0) {
        return { available: false }
      }
      const versionLine = result.stdout.trim()
      return {
        available: true,
        ...(versionLine.length > 0 ? { version: versionLine } : {}),
      }
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
      return runExecFile(npmExecutable, ['install', '-g', `${NPM_WORKFLOW_CLI_PACKAGE}@latest`], opts)
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

      const argv = mapCommandToArgv(params.command, resolvedFileArg)
      const execOpts = execFileOptions(projectRootNorm, timeoutMs)
      return runExecFile(WF_BINARY, argv, execOpts)
    },
  }
}
