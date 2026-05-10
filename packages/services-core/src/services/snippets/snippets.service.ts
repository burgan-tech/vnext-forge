import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

import type { FileSystemAdapter, LoggerAdapter } from '../../adapters/index.js'
import { joinPosix, toPosix } from '../../internal/paths.js'
import type { ProjectService } from '../project/index.js'

import {
  snippetFileSchema,
  type Snippet,
  type SnippetFile,
  type SnippetScope,
  type SnippetsDeleteParams,
  type SnippetsGetOneParams,
  type SnippetsListAllParams,
  type SnippetsListAllResult,
  type SnippetsOpenLocationParams,
  type SnippetsSaveParams,
} from './snippets-schemas.js'

const PROJECT_SNIPPETS_REL = '.vnextstudio/snippets'

export interface SnippetsServiceDeps {
  fs: FileSystemAdapter
  logger: LoggerAdapter
  projectService: ProjectService
  /**
   * Absolute POSIX path to the user's personal snippet directory. The
   * composition root supplies this — typically
   * `${os.homedir()}/.vnext-studio/snippets`. Required because services-core
   * stays Node-free; nothing here calls `os.homedir()` itself.
   */
  personalRoot: string
}

export function createSnippetsService(deps: SnippetsServiceDeps) {
  const { fs, logger, projectService, personalRoot } = deps
  const personalDir = toPosix(personalRoot).replace(/\/+$/, '')

  // ── helpers ───────────────────────────────────────────────────────────────

  async function resolveProjectDir(
    projectId: string,
    traceId?: string,
  ): Promise<string> {
    const project = await projectService.getProject(projectId, traceId)
    return joinPosix(toPosix(project.path).replace(/\/+$/, ''), PROJECT_SNIPPETS_REL)
  }

  async function ensureDirectory(dirPath: string): Promise<void> {
    if (!(await fs.exists(dirPath))) {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  function fileNameFor(id: string): string {
    return `${id}.json`
  }

  function pathFor(dir: string, id: string): string {
    return joinPosix(dir, fileNameFor(id))
  }

  /**
   * Slug helper: turns a snippet `name` into a safe filesystem id.
   * Lowercase, alnum + dash; collapses runs and trims. If empty falls back
   * to a timestamp slug to guarantee uniqueness.
   */
  function deriveIdFromName(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
    if (slug) return slug
    return `snippet-${Date.now()}`
  }

  function ensureSafeId(id: string, traceId?: string): void {
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        `Snippet id "${id}" contains forbidden characters. Use a–z, 0–9, '.', '_', '-'.`,
        { source: 'SnippetsService.ensureSafeId', layer: 'domain', details: { id } },
        traceId,
      )
    }
  }

  async function readSnippetFile(
    filePath: string,
    warnings: string[],
  ): Promise<SnippetFile | null> {
    try {
      const raw = await fs.readFile(filePath)
      const parsed = JSON.parse(raw) as unknown
      const validation = snippetFileSchema.safeParse(parsed)
      if (!validation.success) {
        warnings.push(filePath)
        return null
      }
      return validation.data
    } catch {
      warnings.push(filePath)
      return null
    }
  }

  async function listInDir(
    dir: string,
    scope: SnippetScope,
    warnings: string[],
  ): Promise<Snippet[]> {
    if (!(await fs.exists(dir))) return []
    let entries
    try {
      entries = await fs.readDir(dir)
    } catch {
      return []
    }
    const out: Snippet[] = []
    for (const entry of entries) {
      if (!entry.isFile) continue
      if (!/\.json$/i.test(entry.name)) continue
      const filePath = joinPosix(dir, entry.name)
      const data = await readSnippetFile(filePath, warnings)
      if (!data) continue
      const id = entry.name.replace(/\.json$/i, '')
      out.push({ ...data, id, scope, sourcePath: filePath })
    }
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }

  async function getOneFromDir(
    dir: string,
    id: string,
    scope: SnippetScope,
    traceId?: string,
  ): Promise<Snippet> {
    ensureSafeId(id, traceId)
    const filePath = pathFor(dir, id)
    if (!(await fs.exists(filePath))) {
      throw new VnextForgeError(
        ERROR_CODES.FILE_NOT_FOUND,
        `Snippet "${id}" was not found in scope "${scope}".`,
        {
          source: 'SnippetsService.getOneFromDir',
          layer: 'infrastructure',
          details: { id, scope, filePath },
        },
        traceId,
      )
    }
    const warnings: string[] = []
    const data = await readSnippetFile(filePath, warnings)
    if (!data) {
      throw new VnextForgeError(
        ERROR_CODES.FILE_READ_ERROR,
        `Snippet "${id}" failed to parse.`,
        {
          source: 'SnippetsService.getOneFromDir',
          layer: 'infrastructure',
          details: { id, scope, filePath },
        },
        traceId,
      )
    }
    return { ...data, id, scope, sourcePath: filePath }
  }

  async function dirForScope(
    scope: SnippetScope,
    projectId: string | undefined,
    traceId?: string,
  ): Promise<string> {
    if (scope === 'personal') return personalDir
    if (!projectId) {
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'Project snippets require a projectId.',
        { source: 'SnippetsService.dirForScope', layer: 'domain' },
        traceId,
      )
    }
    return resolveProjectDir(projectId, traceId)
  }

  // ── public methods ────────────────────────────────────────────────────────

  async function listAll(
    params: SnippetsListAllParams,
    traceId?: string,
  ): Promise<SnippetsListAllResult> {
    const { projectId } = params
    const warnings: string[] = []
    const personal = await listInDir(personalDir, 'personal', warnings)
    const project: Snippet[] = projectId
      ? await listInDir(await resolveProjectDir(projectId, traceId), 'project', warnings)
      : []
    if (warnings.length > 0) {
      logger.warn?.(
        {
          source: 'SnippetsService.listAll',
          traceId,
          count: warnings.length,
        },
        'Some snippet files were skipped while listing',
      )
    }
    return { personal, project, warnings }
  }

  async function getOne(
    params: SnippetsGetOneParams,
    traceId?: string,
  ): Promise<{ snippet: Snippet }> {
    const dir = await dirForScope(params.scope, params.projectId, traceId)
    const snippet = await getOneFromDir(dir, params.id, params.scope, traceId)
    return { snippet }
  }

  async function save(
    params: SnippetsSaveParams,
    traceId?: string,
  ): Promise<{ snippet: Snippet; created: boolean }> {
    const dir = await dirForScope(params.scope, params.projectId, traceId)
    await ensureDirectory(dir)

    const requestedId = params.id ?? deriveIdFromName(params.data.name)
    ensureSafeId(requestedId, traceId)

    // If the caller passed an existing `id` we don't change it. If we derived
    // one and a file already exists, append a numeric suffix until we find a
    // free slot — that lets users save several "Untitled" drafts.
    let id = requestedId
    if (!params.id) {
      let suffix = 1
      while (await fs.exists(pathFor(dir, id))) {
        id = `${requestedId}-${suffix++}`
      }
    }

    const existedBefore = await fs.exists(pathFor(dir, id))
    const filePath = pathFor(dir, id)
    const fileBody: SnippetFile = {
      name: params.data.name,
      prefix: params.data.prefix,
      language: params.data.language,
      body: params.data.body,
      ...(params.data.description ? { description: params.data.description } : {}),
      ...(params.data.tags ? { tags: params.data.tags } : {}),
    }
    await fs.writeFile(filePath, JSON.stringify(fileBody, null, 2) + '\n')

    return {
      snippet: { ...fileBody, id, scope: params.scope, sourcePath: filePath },
      created: !existedBefore,
    }
  }

  async function deleteOne(
    params: SnippetsDeleteParams,
    traceId?: string,
  ): Promise<{ deleted: boolean }> {
    ensureSafeId(params.id, traceId)
    const dir = await dirForScope(params.scope, params.projectId, traceId)
    const filePath = pathFor(dir, params.id)
    if (!(await fs.exists(filePath))) {
      return { deleted: false }
    }
    await fs.rmrf(filePath)
    return { deleted: true }
  }

  /**
   * Returns the absolute path the host shell should reveal in Finder /
   * Explorer. When `id` is provided, points at the file; otherwise points at
   * the containing scope directory (creating it on demand for the user).
   */
  async function openLocation(
    params: SnippetsOpenLocationParams,
    traceId?: string,
  ): Promise<{ path: string }> {
    const dir = await dirForScope(params.scope, params.projectId, traceId)
    if (params.id) {
      ensureSafeId(params.id, traceId)
      return { path: pathFor(dir, params.id) }
    }
    await ensureDirectory(dir)
    return { path: dir }
  }

  return { listAll, getOne, save, deleteOne, openLocation }
}

export type SnippetsService = ReturnType<typeof createSnippetsService>
