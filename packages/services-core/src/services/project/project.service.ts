import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import type { VnextComponentsByCategory, VnextExportCategory } from '@vnext-forge-studio/app-contracts'
import type { z } from 'zod'

import type {
  FileSystemAdapter,
  LoggerAdapter,
  WorkspaceRootResolver,
} from '../../adapters/index.js'
import { getErrnoCode } from '../../internal/errno.js'
import { basename, isAbsolutePosix, joinPosix, relativePosix, toPosix } from '../../internal/paths.js'
import type { PathPolicy } from '../../internal/path-policy.js'
import { CONFIG_FILE } from '../workspace/constants.js'
import type {
  VnextWorkspaceConfig,
  VnextWorkspacePaths,
  WorkspaceConfigReadStatus,
} from '../workspace/types.js'
import type { WorkspaceService } from '../workspace/index.js'
import type { TemplateService } from '../template/index.js'
import type {
  ComponentFileTypeMap,
  LinkFile,
  ProjectConfigStatus,
  ProjectEntry,
  SeedVnextComponentLayoutResult,
  VnextComponentLayoutStatusResult,
} from './types.js'
import { vnextWorkspaceFullConfigSchema, vnextWorkspacePathsInputSchema } from './project-schemas.js'
import { emptyVnextComponentBuckets, scanVnextComponents } from './vnext-component-scanner.js'

const COMPONENT_LAYOUT_PATH_KEYS: (keyof Omit<VnextWorkspacePaths, 'componentsRoot'>)[] = [
  'tasks',
  'views',
  'functions',
  'extensions',
  'workflows',
  'schemas',
]

const EXPECTED_TEMPLATE_FILES = [
  'package.json',
  'validate.js',
  'build.js',
  'index.js',
  'setup.js',
  'sync-schema-version.js',
]

const FLOW_HEAD_BYTES = 512
const FLOW_REGEX = /"flow"\s*:\s*"(sys-[a-z]+)"/

/**
 * Bootstrap sırasında bileşen kökündeki tüm `.json` dosyalarını okuyup `flow` alanına göre
 * dosya ağacı ikon eşlemesi (`componentFileTypes`) üretmek maliyetlidir. `false` iken
 * `getWorkspaceBootstrap` bu taramayı yapmaz; `projects/getComponentFileTypes` RPC’si etkilenmez.
 */
const WORKSPACE_BOOTSTRAP_SCAN_COMPONENT_FILE_TYPES = false

type WriteProjectConfigInput = z.infer<typeof vnextWorkspaceFullConfigSchema>

export interface ProjectServiceDeps {
  fs: FileSystemAdapter
  logger: LoggerAdapter
  workspaceRootResolver: WorkspaceRootResolver
  workspaceService: WorkspaceService
  templateService: TemplateService
  /**
   * Optional filesystem jail. When provided, every project operation that
   * accepts a caller-supplied path (`createProject`, `importProject`,
   * `exportProject`) is gated through it before any I/O happens.
   */
  pathPolicy?: PathPolicy
}

export function createProjectService(deps: ProjectServiceDeps) {
  const { fs, workspaceRootResolver, workspaceService, templateService, pathPolicy } = deps

  async function getProjectsRoot(): Promise<string> {
    return workspaceRootResolver.resolveProjectsRoot()
  }

  async function ensureProjectsDir(): Promise<void> {
    const root = await getProjectsRoot()
    await fs.mkdir(root, { recursive: true })
  }

  async function resolveProjectPath(
    id: string,
    traceId?: string,
  ): Promise<{ projectPath: string; linked: boolean }> {
    // Extension shell convention: workspace folder IS the project, so we
    // pass its absolute path as the projectId. Honour that shortcut and
    // skip the projects-root link file lookup — there is no separate
    // project registry on that shell.
    if (id.startsWith('/') || /^[A-Za-z]:[\\/]/.test(id)) {
      return { projectPath: toPosix(id), linked: false }
    }
    const root = await getProjectsRoot()
    const linkPath = joinPosix(root, `${id}.link.json`)
    try {
      const linkRaw = await fs.readFile(linkPath)
      const link = JSON.parse(linkRaw) as LinkFile
      return { projectPath: link.sourcePath, linked: true }
    } catch (error) {
      const code = getErrnoCode(error)
      if (code && code !== 'ENOENT' && code !== 'FileNotFound') {
        throw toProjectError(error, 'ProjectService.resolveProjectPath', traceId, { id, linkPath })
      }
    }
    return { projectPath: joinPosix(root, id), linked: false }
  }

  async function listProjects(traceId?: string): Promise<ProjectEntry[]> {
    await ensureProjectsDir()
    const root = await getProjectsRoot()
    try {
      const entries = await fs.readDir(root)
      const projects: ProjectEntry[] = []
      const seenIds = new Set<string>()

      for (const entry of entries) {
        if (!entry.isFile || !entry.name.endsWith('.link.json')) continue
        const id = entry.name.replace('.link.json', '')
        seenIds.add(id)
        try {
          const linkRaw = await fs.readFile(joinPosix(root, entry.name))
          const link = JSON.parse(linkRaw) as LinkFile
          projects.push(await toProjectEntry(id, link.sourcePath, true, traceId, link.domain))
        } catch {
          // Ignore invalid link files while listing the rest.
        }
      }

      for (const entry of entries) {
        if (!entry.isDirectory || seenIds.has(entry.name)) continue
        const rootPath = joinPosix(root, entry.name)
        projects.push(await toProjectEntry(entry.name, rootPath, false, traceId))
      }

      return projects
    } catch (error) {
      throw toProjectError(error, 'ProjectService.listProjects', traceId)
    }
  }

  async function getProject(id: string, traceId?: string): Promise<ProjectEntry> {
    const { projectPath, linked } = await resolveProjectPath(id, traceId)
    try {
      const stat = await fs.stat(projectPath)
      if (!stat.isDirectory) {
        throw new VnextForgeError(
          ERROR_CODES.PROJECT_NOT_FOUND,
          'Project directory was not found',
          { source: 'ProjectService.getProject', layer: 'application', details: { id, projectPath } },
          traceId,
        )
      }
    } catch (error) {
      if (error instanceof VnextForgeError) throw error
      throw toProjectError(error, 'ProjectService.getProject', traceId, { id, projectPath })
    }
    return toProjectEntry(id, projectPath, linked, traceId)
  }

  async function createProject(
    domain: string,
    description: string | undefined,
    targetPath: string | undefined,
    traceId?: string,
  ): Promise<ProjectEntry> {
    await ensureProjectsDir()
    const root = await getProjectsRoot()
    const normalizedDomain = domain.trim()
    const normalizedTargetPath = targetPath?.trim()
    const rootPath = normalizedTargetPath
      ? joinPosix(normalizedTargetPath, normalizedDomain)
      : joinPosix(root, normalizedDomain)

    // Caller-supplied targetPath is the SSRF-equivalent for the file
    // system: without this gate, a privileged client could materialize a
    // freshly scaffolded template anywhere on disk (e.g. inside another
    // user's home dir on a multi-tenant deployment).
    if (pathPolicy && normalizedTargetPath) {
      await pathPolicy.assertWritable(rootPath, traceId)
    }

    if (await fs.exists(rootPath)) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_ALREADY_EXISTS,
        'Project already exists',
        {
          source: 'ProjectService.createProject',
          layer: 'application',
          details: { domain: normalizedDomain, rootPath },
        },
        traceId,
      )
    }

    try {
      await templateService.scaffoldFromTemplate(rootPath, normalizedDomain, traceId)

      const config = workspaceService.createDefaultConfig(normalizedDomain, description)
      await fs.writeFile(
        workspaceService.getConfigPath(rootPath),
        JSON.stringify(config, null, 2),
      )

      if (normalizedTargetPath) {
        await writeLinkFile(normalizedDomain, rootPath)
        return toProjectEntry(normalizedDomain, rootPath, true, traceId)
      }
      return toProjectEntry(normalizedDomain, rootPath, false, traceId)
    } catch (error) {
      throw toProjectError(error, 'ProjectService.createProject', traceId, {
        domain: normalizedDomain,
        rootPath,
      })
    }
  }

  async function importProject(sourcePath: string, traceId?: string): Promise<ProjectEntry> {
    const resolvedSource = toPosix(sourcePath)
    if (pathPolicy) await pathPolicy.assertReadable(resolvedSource, traceId)
    const status: WorkspaceConfigReadStatus = await workspaceService.readConfigStatus(resolvedSource, traceId)
    await ensureProjectsDir()

    if (status.status === 'ok') {
      const domain = status.config.domain
      await writeLinkFile(domain, resolvedSource)
      return toProjectEntry(domain, resolvedSource, true, traceId)
    }

    const fallbackDomain = deriveImportDomainFromPath(resolvedSource)
    await writeLinkFile(fallbackDomain, resolvedSource)
    return toProjectEntry(fallbackDomain, resolvedSource, true, traceId, fallbackDomain)
  }

  async function getConfigStatus(id: string, traceId?: string): Promise<ProjectConfigStatus> {
    const { projectPath } = await resolveProjectPath(id, traceId)
    return workspaceService.readConfigStatus(projectPath, traceId)
  }

  async function writeProjectConfig(
    id: string,
    input: WriteProjectConfigInput,
    traceId?: string,
  ): Promise<ProjectEntry> {
    const { projectPath, linked } = await resolveProjectPath(id, traceId)
    const configJson = input as VnextWorkspaceConfig

    await fs.writeFile(joinPosix(projectPath, CONFIG_FILE), JSON.stringify(configJson, null, 2))

    if (linked) {
      const root = await getProjectsRoot()
      if (id !== configJson.domain) {
        const oldLinkPath = joinPosix(root, `${id}.link.json`)
        try {
          await fs.deleteFile(oldLinkPath)
        } catch (error) {
          const code = getErrnoCode(error)
          if (code !== 'ENOENT' && code !== 'FileNotFound') {
            throw toProjectError(error, 'ProjectService.writeProjectConfig', traceId, {
              id,
              oldLinkPath,
            })
          }
        }
      }
      await writeLinkFile(configJson.domain, projectPath)
    }

    const nextId = linked ? configJson.domain : id
    return getProject(nextId, traceId)
  }

  async function getFileTree(id: string, traceId?: string) {
    const { projectPath } = await resolveProjectPath(id, traceId)
    return workspaceService.getFileTree(projectPath, traceId)
  }

  async function getConfig(id: string, traceId?: string) {
    const { projectPath } = await resolveProjectPath(id, traceId)
    return workspaceService.getConfig(projectPath, traceId)
  }

  async function getValidateScriptStatus(id: string, traceId?: string): Promise<{ exists: boolean }> {
    const { projectPath } = await resolveProjectPath(id, traceId)
    return templateService.checkValidateScript(projectPath)
  }

  async function projectRootHasOnlyVnextConfigFile(projectPath: string): Promise<boolean> {
    const entries = await fs.readDir(projectPath)
    const relevant = entries.filter(
      (e) => e.name !== '.DS_Store' && e.name !== 'Thumbs.db' && e.name !== 'desktop.ini',
    )
    if (relevant.length !== 1) return false
    const only = relevant[0]
    return only.isFile && only.name === CONFIG_FILE
  }

  async function computeVnextComponentLayoutStatus(
    projectPath: string,
    id: string,
    config: VnextWorkspaceConfig,
    traceId?: string,
  ): Promise<VnextComponentLayoutStatusResult> {
    const projectContainsOnlyConfigFile = await projectRootHasOnlyVnextConfigFile(projectPath)
    const dirs = collectComponentLayoutDirectories(projectPath, config.paths, traceId)

    const missingLayoutPaths: string[] = []

    for (const templateFile of EXPECTED_TEMPLATE_FILES) {
      const filePath = joinPosix(projectPath, templateFile)
      if (!(await fs.exists(filePath))) {
        missingLayoutPaths.push(templateFile)
      }
    }

    for (const dir of dirs) {
      const rel = toProjectRelativePosixPath(projectPath, dir)
      try {
        const stat = await fs.stat(dir)
        if (!stat.isDirectory) missingLayoutPaths.push(rel)
      } catch (error) {
        const code = getErrnoCode(error)
        if (code === 'ENOENT' || code === 'FileNotFound') {
          missingLayoutPaths.push(rel)
        } else {
          throw toProjectError(error, 'ProjectService.getVnextComponentLayoutStatus', traceId, {
            id,
            dir,
          })
        }
      }
    }

    let componentsRootPresent = false
    const componentsRootResolved = dirs[0]
    if (componentsRootResolved) {
      try {
        const stat = await fs.stat(componentsRootResolved)
        componentsRootPresent = stat.isDirectory
      } catch {
        componentsRootPresent = false
      }
    }

    return {
      projectContainsOnlyConfigFile,
      componentsRootPresent,
      missingLayoutPaths,
      layoutComplete: missingLayoutPaths.length === 0,
    }
  }

  async function getVnextComponentLayoutStatus(
    id: string,
    traceId?: string,
  ): Promise<VnextComponentLayoutStatusResult> {
    const { path: projectPath } = await getProject(id, traceId)
    const status = await workspaceService.readConfigStatus(projectPath, traceId)

    if (status.status !== 'ok') {
      const message =
        status.status === 'missing'
          ? 'vnext.config.json was not found.'
          : status.status === 'invalid'
            ? status.message
            : 'Project configuration could not be read.'
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        message,
        {
          source: 'ProjectService.getVnextComponentLayoutStatus',
          layer: 'application',
          details: { id, configStatus: status.status },
        },
        traceId,
      )
    }

    return computeVnextComponentLayoutStatus(projectPath, id, status.config, traceId)
  }

  async function seedVnextComponentLayoutFromConfig(
    id: string,
    traceId?: string,
  ): Promise<SeedVnextComponentLayoutResult> {
    const { path: projectPath } = await getProject(id, traceId)
    const status = await workspaceService.readConfigStatus(projectPath, traceId)
    if (status.status !== 'ok') {
      const message =
        status.status === 'missing'
          ? 'vnext.config.json was not found.'
          : status.status === 'invalid'
            ? status.message
            : 'Project configuration could not be read.'
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        message,
        {
          source: 'ProjectService.seedVnextComponentLayoutFromConfig',
          layer: 'application',
          details: { id, status: status.status },
        },
        traceId,
      )
    }

    const config = status.config
    const tmpDir = joinPosix(projectPath, '.vnext-template-tmp')
    if (await fs.exists(tmpDir)) {
      await fs.rmrf(tmpDir)
    }

    await templateService.scaffoldFromTemplate(tmpDir, config.domain, traceId)

    const tmpEntries = await fs.readDir(tmpDir)
    for (const entry of tmpEntries) {
      if (entry.name === 'node_modules') continue
      const src = joinPosix(tmpDir, entry.name)
      const dest = joinPosix(projectPath, entry.name)
      if (!(await fs.exists(dest))) {
        await fs.rename(src, dest)
      }
    }
    if (await fs.exists(tmpDir)) {
      await fs.rmrf(tmpDir)
    }

    await templateService.applyCustomConfig(projectPath, config.domain, config, traceId)

    const dirs = collectComponentLayoutDirectories(projectPath, config.paths, traceId)
    const ensuredPaths: string[] = []
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true })
      ensuredPaths.push(toProjectRelativePosixPath(projectPath, dir))
    }

    return { ensuredPaths }
  }

  async function getComponentFileTypesFromResolved(
    projectPath: string,
    config: VnextWorkspaceConfig,
  ): Promise<ComponentFileTypeMap> {
    const componentsRoot = config.paths.componentsRoot.trim()
    if (!componentsRoot || isAbsolutePosix(componentsRoot)) return {}

    const componentsRootAbsolute = joinPosix(projectPath, componentsRoot)
    try {
      const stat = await fs.stat(componentsRootAbsolute)
      if (!stat.isDirectory) return {}
    } catch {
      return {}
    }

    const result: ComponentFileTypeMap = {}
    await collectJsonFlowTypes(componentsRootAbsolute, projectPath, result)
    return result
  }

  async function getComponentFileTypes(
    id: string,
    traceId?: string,
  ): Promise<ComponentFileTypeMap> {
    const { projectPath } = await resolveProjectPath(id, traceId)
    const status = await workspaceService.readConfigStatus(projectPath, traceId)
    if (status.status !== 'ok') return {}

    return getComponentFileTypesFromResolved(projectPath, status.config)
  }

  async function collectJsonFlowTypes(
    dirPath: string,
    projectRoot: string,
    result: ComponentFileTypeMap,
  ): Promise<void> {
    let entries
    try {
      entries = await fs.readDir(dirPath)
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = joinPosix(dirPath, entry.name)
      if (entry.isDirectory) {
        await collectJsonFlowTypes(fullPath, projectRoot, result)
      } else if (entry.name.endsWith('.json')) {
        const flow = await extractFlowFromHead(fullPath)
        if (flow) {
          const relativePath = relativePosix(projectRoot, fullPath)
          result[relativePath] = flow
        }
      }
    }
  }

  async function extractFlowFromHead(filePath: string): Promise<string | null> {
    try {
      const buf = await fs.readFileHead(filePath, FLOW_HEAD_BYTES)
      const head = buf.toString('utf-8')
      const match = FLOW_REGEX.exec(head)
      return match ? match[1] : null
    } catch {
      return null
    }
  }

  async function exportProject(
    id: string,
    targetPath: string,
    traceId?: string,
  ): Promise<{ success: true; exportPath: string }> {
    const { projectPath } = await resolveProjectPath(id, traceId)
    if (pathPolicy) await pathPolicy.assertWritable(targetPath, traceId)
    try {
      await fs.copyRecursive(projectPath, targetPath)
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_SAVE_ERROR,
        error instanceof Error ? error.message : 'Project export failed',
        {
          source: 'ProjectService.exportProject',
          layer: 'infrastructure',
          details: { projectPath, targetPath },
        },
        traceId,
      )
    }
    return { success: true, exportPath: targetPath }
  }

  async function removeProject(id: string, traceId?: string): Promise<{ success: boolean }> {
    await ensureProjectsDir()
    const root = await getProjectsRoot()
    const linkPath = joinPosix(root, `${id}.link.json`)
    try {
      await fs.deleteFile(linkPath)
      return { success: true }
    } catch (error) {
      const code = getErrnoCode(error)
      if (code && code !== 'ENOENT' && code !== 'FileNotFound') {
        throw toProjectError(error, 'ProjectService.removeProject', traceId, { id, linkPath })
      }
    }
    const directPath = joinPosix(root, id)
    try {
      await fs.rmrf(directPath)
      return { success: true }
    } catch (error) {
      throw toProjectError(error, 'ProjectService.removeProject', traceId, { id, directPath })
    }
  }

  // ── private helpers ───────────────────────────────────────────────────────

  function deriveImportDomainFromPath(resolvedSource: string): string {
    const base = basename(resolvedSource).trim() || 'workspace'
    const cleaned = base.replace(/[\\/:*?"<>|]/g, '-').replace(/^\.+/, '') || 'workspace'
    const reserved =
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(cleaned) ||
      cleaned === '.' ||
      cleaned === '..'
    const candidate = reserved ? `${cleaned}-workspace` : cleaned
    if (candidate.length > 120) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'Domain name derived from folder is too long',
        {
          source: 'ProjectService.deriveImportDomainFromPath',
          layer: 'application',
          details: { resolvedSource, candidate },
        },
      )
    }
    return candidate
  }

  async function writeLinkFile(domain: string, sourcePath: string): Promise<void> {
    const root = await getProjectsRoot()
    const link: LinkFile = { sourcePath, domain, importedAt: new Date().toISOString() }
    await fs.writeFile(joinPosix(root, `${domain}.link.json`), JSON.stringify(link, null, 2))
  }

  async function toProjectEntry(
    id: string,
    rootPath: string,
    linked: boolean,
    traceId?: string,
    fallbackDomain?: string,
  ): Promise<ProjectEntry> {
    try {
      const config = await workspaceService.getConfig(rootPath, traceId)
      return {
        id,
        domain: config.domain || fallbackDomain || id,
        description: config.description,
        path: rootPath,
        version: config.version,
        linked,
      }
    } catch {
      return { id, domain: fallbackDomain || id, path: rootPath, linked }
    }
  }

  /**
   * Bootstrap-only: tek `readConfigStatus` sonucundan `ProjectEntry` üretir; `status !== 'ok'`
   * iken `toProjectEntry` ile aynı davranışı korumak için `getConfig` yoluna düşer (ekstra okuma).
   */
  async function buildProjectEntryForBootstrap(
    id: string,
    projectPath: string,
    linked: boolean,
    configStatus: ProjectConfigStatus,
    traceId?: string,
  ): Promise<ProjectEntry> {
    if (configStatus.status === 'ok') {
      const c = configStatus.config
      return {
        id,
        domain: c.domain || id,
        description: c.description,
        path: projectPath,
        version: c.version,
        linked,
      }
    }
    return toProjectEntry(id, projectPath, linked, traceId)
  }

  function collectComponentLayoutDirectories(
    projectRoot: string,
    paths: VnextWorkspacePaths,
    traceId?: string,
  ): string[] {
    const componentsRoot = paths.componentsRoot.trim()
    if (!componentsRoot) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'paths.componentsRoot must not be empty.',
        { source: 'ProjectService.collectComponentLayoutDirectories', layer: 'application' },
        traceId,
      )
    }
    if (isAbsolutePosix(componentsRoot)) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'paths.componentsRoot must be relative.',
        {
          source: 'ProjectService.collectComponentLayoutDirectories',
          layer: 'application',
          details: { componentsRoot },
        },
        traceId,
      )
    }

    const resolved: string[] = []
    const baseResolved = joinPosix(projectRoot, componentsRoot)
    assertResolvedPathInsideProject(projectRoot, baseResolved, traceId)
    resolved.push(baseResolved)

    for (const key of COMPONENT_LAYOUT_PATH_KEYS) {
      const segment = paths[key].trim()
      if (!segment) continue
      if (isAbsolutePosix(segment)) {
        throw new VnextForgeError(
          ERROR_CODES.PROJECT_INVALID_CONFIG,
          `paths.${String(key)} must be relative.`,
          {
            source: 'ProjectService.collectComponentLayoutDirectories',
            layer: 'application',
            details: { key, segment },
          },
          traceId,
        )
      }
      const full = joinPosix(projectRoot, componentsRoot, segment)
      assertResolvedPathInsideProject(projectRoot, full, traceId)
      resolved.push(full)
    }

    const seen = new Set<string>()
    const unique: string[] = []
    for (const dir of resolved) {
      if (seen.has(dir)) continue
      seen.add(dir)
      unique.push(dir)
    }
    return unique
  }

  function assertResolvedPathInsideProject(
    projectRoot: string,
    targetAbsolute: string,
    traceId?: string,
  ): void {
    const root = toPosix(projectRoot).replace(/\/+$/, '')
    const target = toPosix(targetAbsolute)
    if (target === root) return
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'vnext.config.json paths must not escape the project root.',
        {
          source: 'ProjectService.assertResolvedPathInsideProject',
          layer: 'application',
          details: { projectRoot: root, target },
        },
        traceId,
      )
    }
  }

  function toProjectRelativePosixPath(projectRoot: string, absoluteDir: string): string {
    const rel = relativePosix(toPosix(projectRoot), toPosix(absoluteDir))
    return rel === '' ? '.' : rel
  }

  function toProjectError(
    error: unknown,
    source: string,
    traceId?: string,
    details?: Record<string, unknown>,
  ): VnextForgeError {
    if (error instanceof VnextForgeError) return error
    const code = getErrnoCode(error)
    if (code === 'ENOENT' || code === 'FileNotFound') {
      return new VnextForgeError(
        ERROR_CODES.PROJECT_NOT_FOUND,
        'Project was not found',
        { source, layer: 'application', details },
        traceId,
      )
    }
    if (code === 'EEXIST' || code === 'FileExists') {
      return new VnextForgeError(
        ERROR_CODES.PROJECT_ALREADY_EXISTS,
        'Project already exists',
        { source, layer: 'application', details },
        traceId,
      )
    }
    return new VnextForgeError(
      ERROR_CODES.PROJECT_LOAD_ERROR,
      error instanceof Error ? error.message : 'Project operation failed',
      { source, layer: 'application', details },
      traceId,
    )
  }

  /**
   * Aggregates everything the designer needs to render a project workspace
   * into a single round-trip.
   *
   * Without this, the UI fires 6 sequential/parallel RPC calls every time a
   * project is opened (`projects.getById`, `projects.getTree`,
   * `projects.getConfigStatus`, `projects.getVnextComponentLayoutStatus`,
   * `projects.getValidateScriptStatus`, `projects.getComponentFileTypes`). In
   * React 19 StrictMode dev that doubles to 12. Aggregating server-side keeps
   * the wire to a single POST and lets us run the layout/validate/file-types
   * triple in parallel after we know the config is OK.
   *
   * Cheap fields (`project`, `tree`, `configStatus`) are always returned.
   * Expensive fields (`layoutStatus`, `validateScriptStatus`,
   * `componentFileTypes`) are only computed when `configStatus.status === 'ok'`,
   * mirroring what the UI used to do client-side. `componentFileTypes` can be
   * forced to `null` via `WORKSPACE_BOOTSTRAP_SCAN_COMPONENT_FILE_TYPES` to skip
   * JSON `flow` scanning on bootstrap.
   *
   * Tek `resolveProjectPath`, tek `readConfigStatus` ve (ok iken) `getProject`/`getConfig`
   * tekrarını atlayacak şekilde `project` + ikinci faz layout/file-types için önceden
   * çözülmüş yol ve config kullanılır.
   */
  async function getWorkspaceBootstrap(id: string, traceId?: string) {
    const { projectPath, linked } = await resolveProjectPath(id, traceId)
    try {
      const stat = await fs.stat(projectPath)
      if (!stat.isDirectory) {
        throw new VnextForgeError(
          ERROR_CODES.PROJECT_NOT_FOUND,
          'Project directory was not found',
          {
            source: 'ProjectService.getProject',
            layer: 'application',
            details: { id, projectPath },
          },
          traceId,
        )
      }
    } catch (error) {
      if (error instanceof VnextForgeError) throw error
      throw toProjectError(error, 'ProjectService.getProject', traceId, { id, projectPath })
    }

    const [configStatus, tree] = await Promise.all([
      workspaceService.readConfigStatus(projectPath, traceId),
      workspaceService.getFileTree(projectPath, traceId),
    ])

    const project = await buildProjectEntryForBootstrap(id, projectPath, linked, configStatus, traceId)

    if (configStatus.status !== 'ok') {
      return {
        project,
        tree,
        configStatus,
        layoutStatus: null,
        validateScriptStatus: null,
        componentFileTypes: null,
      }
    }

    const [layoutStatus, validateScriptStatus, componentFileTypes] = await Promise.all([
      computeVnextComponentLayoutStatus(projectPath, id, configStatus.config, traceId).catch(() => null),
      templateService.checkValidateScript(projectPath).catch(() => null),
      WORKSPACE_BOOTSTRAP_SCAN_COMPONENT_FILE_TYPES
        ? getComponentFileTypesFromResolved(projectPath, configStatus.config).catch(() => null)
        : Promise.resolve(null),
    ])

    return {
      project,
      tree,
      configStatus,
      layoutStatus,
      validateScriptStatus,
      componentFileTypes,
    }
  }

  // TODO: optional LRU cache keyed by `${id}:${configMTime}` when listVnextComponents is hot.
  async function listVnextComponents(
    id: string,
    input: { category?: VnextExportCategory; previewPaths?: string },
    traceId?: string,
  ): Promise<{ components: VnextComponentsByCategory }> {
    const { projectPath } = await resolveProjectPath(id, traceId)
    let paths: VnextWorkspacePaths | undefined

    if (input.previewPaths != null && String(input.previewPaths).trim() !== '') {
      let raw: unknown
      try {
        raw = JSON.parse(String(input.previewPaths))
      } catch {
        throw new VnextForgeError(
          ERROR_CODES.PROJECT_INVALID_CONFIG,
          'previewPaths must be valid JSON',
          { source: 'ProjectService.listVnextComponents', layer: 'application', details: { id } },
          traceId,
        )
      }
      const parsed = vnextWorkspacePathsInputSchema.safeParse(raw)
      if (!parsed.success) {
        throw new VnextForgeError(
          ERROR_CODES.PROJECT_INVALID_CONFIG,
          'Invalid previewPaths shape',
          { source: 'ProjectService.listVnextComponents', layer: 'application', details: { id } },
          traceId,
        )
      }
      paths = parsed.data
    } else {
      const status = await workspaceService.readConfigStatus(projectPath, traceId)
      if (status.status !== 'ok') {
        return { components: emptyVnextComponentBuckets() }
      }
      paths = status.config.paths
    }

    return scanVnextComponents(fs, projectPath, paths, { onlyCategory: input.category })
  }

  return {
    listProjects,
    getProject,
    createProject,
    importProject,
    getConfigStatus,
    writeProjectConfig,
    getFileTree,
    getConfig,
    getValidateScriptStatus,
    getVnextComponentLayoutStatus,
    seedVnextComponentLayoutFromConfig,
    getComponentFileTypes,
    getWorkspaceBootstrap,
    listVnextComponents,
    exportProject,
    removeProject,
  }
}

export type ProjectService = ReturnType<typeof createProjectService>
