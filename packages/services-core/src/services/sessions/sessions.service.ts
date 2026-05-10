import type { FileSystemAdapter, LoggerAdapter } from '../../adapters/index.js'
import { joinPosix, toPosix } from '../../internal/paths.js'
import type { ProjectService } from '../project/index.js'

import {
  workspaceSessionSchema,
  type SessionsClearParams,
  type SessionsClearResult,
  type SessionsGetParams,
  type SessionsGetResult,
  type SessionsSaveParams,
  type SessionsSaveResult,
  type WorkspaceSession,
} from './sessions-schemas.js'

/**
 * Sessions live in the user's home (`~/.vnext-studio/sessions/<projectId>.json`)
 * — never inside the project tree. That keeps per-developer state out of
 * Git completely without needing any `.gitignore` plumbing in the project.
 *
 * Snippets (also under `.vnextstudio/`) are deliberately project-tracked
 * for team sharing — that's a separate path; this service doesn't touch it.
 */

export interface SessionsServiceDeps {
  fs: FileSystemAdapter
  logger: LoggerAdapter
  projectService: ProjectService
  /**
   * Absolute root for per-user session files (no trailing slash). Composition
   * passes `${os.homedir()}/.vnext-studio/sessions` — services-core stays
   * Node-free and never resolves `homedir()` itself.
   */
  personalRoot: string
}

/**
 * Strip everything but `[A-Za-z0-9._-]` so the projectId is filesystem-safe
 * on macOS / Linux / Windows alike. Length-capped at 100 chars so unusually
 * long ids don't blow past PATH_MAX.
 */
function sanitizeProjectId(projectId: string): string {
  return projectId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100)
}

export function createSessionsService(deps: SessionsServiceDeps) {
  const { fs, logger, projectService, personalRoot } = deps
  const sessionsRoot = toPosix(personalRoot).replace(/\/+$/, '')

  function sessionPath(projectId: string): string {
    return joinPosix(sessionsRoot, `${sanitizeProjectId(projectId)}.json`)
  }

  async function ensureDirOf(filePath: string): Promise<void> {
    const dir = filePath.replace(/\/[^/]+$/, '')
    if (!(await fs.exists(dir))) {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  async function get(
    params: SessionsGetParams,
    traceId?: string,
  ): Promise<SessionsGetResult> {
    // Validate the projectId resolves to a real project — surfaces an early
    // error (vs. silently returning null) when the caller passes garbage.
    await projectService.getProject(params.projectId, traceId)

    const path = sessionPath(params.projectId)
    if (!(await fs.exists(path))) {
      return { session: null }
    }
    let raw: string
    try {
      raw = await fs.readFile(path)
    } catch (err) {
      logger.warn?.(
        {
          source: 'SessionsService.get',
          traceId,
          path,
          error: err instanceof Error ? err.message : String(err),
        },
        'Failed to read session file; treating as missing.',
      )
      return { session: null }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      logger.warn?.(
        { source: 'SessionsService.get', traceId, path },
        'Session file is not valid JSON; treating as missing.',
      )
      return { session: null }
    }
    const validation = workspaceSessionSchema.safeParse(parsed)
    if (!validation.success) {
      logger.warn?.(
        {
          source: 'SessionsService.get',
          traceId,
          path,
          issues: validation.error.issues.length,
        },
        'Session file failed schema validation; treating as missing.',
      )
      return { session: null }
    }
    return { session: validation.data }
  }

  async function save(
    params: SessionsSaveParams,
    traceId?: string,
  ): Promise<SessionsSaveResult> {
    // Same early-exists check as get(): refuses unknown projectIds.
    await projectService.getProject(params.projectId, traceId)

    const path = sessionPath(params.projectId)
    await ensureDirOf(path)

    const session: WorkspaceSession = {
      ...params.session,
      lastSavedAt: new Date().toISOString(),
    }
    await fs.writeFile(path, JSON.stringify(session, null, 2) + '\n')
    return { ok: true as const, path }
  }

  async function clear(
    params: SessionsClearParams,
    traceId?: string,
  ): Promise<SessionsClearResult> {
    await projectService.getProject(params.projectId, traceId)
    const path = sessionPath(params.projectId)
    if (!(await fs.exists(path))) return { cleared: false }
    await fs.rmrf(path)
    return { cleared: true }
  }

  return { get, save, clear }
}

export type SessionsService = ReturnType<typeof createSessionsService>
