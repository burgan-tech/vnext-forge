import fs from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { z } from 'zod'
import type { VnextWorkspaceConfigJson } from '@vnext-forge/app-contracts'
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import { CONFIG_FILE } from '@workspace/constants.js'
import { WorkspaceService } from '@workspace/service.js'
import { projectWriteFullConfigRequestSchema } from './schema.js'
import type {
  ProjectConfigStatus,
  ProjectEntry,
  LinkFile,
  SeedVnextComponentLayoutResult,
  VnextComponentLayoutStatusResult,
} from './types.js'
import type { WorkspacePaths } from '@workspace/types.js'

type WriteProjectConfigInput = z.infer<(typeof projectWriteFullConfigRequestSchema)['json']>

const PROJECTS_DIR = path.join(homedir(), 'vnext-projects')

const COMPONENT_LAYOUT_PATH_KEYS: (keyof Omit<WorkspacePaths, 'componentsRoot'>)[] = [
  'tasks',
  'views',
  'functions',
  'extensions',
  'workflows',
  'schemas',
]

export class ProjectService {
  constructor(private readonly workspaceService = new WorkspaceService()) {}

  async ensureProjectsDir(): Promise<void> {
    await fs.mkdir(PROJECTS_DIR, { recursive: true })
  }

  async resolveProjectPath(
    id: string,
    traceId?: string,
  ): Promise<{ projectPath: string; linked: boolean }> {
    const linkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
    try {
      const linkRaw = await fs.readFile(linkPath, 'utf-8')
      const link = JSON.parse(linkRaw) as LinkFile
      return { projectPath: link.sourcePath, linked: true }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code && code !== 'ENOENT') {
        throw this.toProjectError(error, 'ProjectService.resolveProjectPath', traceId, { id, linkPath })
      }
    }
    return { projectPath: path.join(PROJECTS_DIR, id), linked: false }
  }

  async listProjects(traceId?: string): Promise<ProjectEntry[]> {
    await this.ensureProjectsDir()
    try {
      const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
      const projects: ProjectEntry[] = []
      const seenIds = new Set<string>()

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.link.json')) continue
        const id = entry.name.replace('.link.json', '')
        seenIds.add(id)
        try {
          const linkRaw = await fs.readFile(path.join(PROJECTS_DIR, entry.name), 'utf-8')
          const link = JSON.parse(linkRaw) as LinkFile
          projects.push(await this.toProjectEntry(id, link.sourcePath, true, traceId, link.domain))
        } catch {
          // Ignore invalid link files while listing the rest.
        }
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || seenIds.has(entry.name)) continue
        const rootPath = path.join(PROJECTS_DIR, entry.name)
        projects.push(await this.toProjectEntry(entry.name, rootPath, false, traceId))
      }

      return projects
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.listProjects', traceId)
    }
  }

  async getProject(id: string, traceId?: string): Promise<ProjectEntry> {
    const { projectPath, linked } = await this.resolveProjectPath(id, traceId)
    try {
      const stat = await fs.stat(projectPath)
      if (!stat.isDirectory()) {
        throw new VnextForgeError(
          ERROR_CODES.PROJECT_NOT_FOUND,
          'Project directory was not found',
          { source: 'ProjectService.getProject', layer: 'application', details: { id, projectPath } },
          traceId,
        )
      }
    } catch (error) {
      if (error instanceof VnextForgeError) throw error
      throw this.toProjectError(error, 'ProjectService.getProject', traceId, { id, projectPath })
    }
    return this.toProjectEntry(id, projectPath, linked, traceId)
  }

  async createProject(
    domain: string,
    description?: string,
    targetPath?: string,
    traceId?: string,
  ): Promise<ProjectEntry> {
    await this.ensureProjectsDir()
    const normalizedDomain = domain.trim()
    const normalizedTargetPath = targetPath?.trim()
    const rootPath = normalizedTargetPath
      ? path.resolve(normalizedTargetPath, normalizedDomain)
      : path.join(PROJECTS_DIR, normalizedDomain)

    try {
      await fs.access(rootPath)
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
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (error instanceof VnextForgeError) throw error
      if (code && code !== 'ENOENT') {
        throw this.toProjectError(error, 'ProjectService.createProject', traceId, {
          domain: normalizedDomain,
          rootPath,
        })
      }
    }

    try {
      await fs.mkdir(rootPath, { recursive: true })
      for (const componentPath of this.workspaceService.getComponentPaths(rootPath, normalizedDomain)) {
        await fs.mkdir(componentPath, { recursive: true })
      }
      const config = this.workspaceService.createDefaultConfig(normalizedDomain, description)
      await fs.writeFile(
        this.workspaceService.getConfigPath(rootPath),
        JSON.stringify(config, null, 2),
        'utf-8',
      )
      if (normalizedTargetPath) {
        await this.writeLinkFile(normalizedDomain, rootPath)
        return this.toProjectEntry(normalizedDomain, rootPath, true, traceId)
      }
      return this.toProjectEntry(normalizedDomain, rootPath, false, traceId)
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.createProject', traceId, {
        domain: normalizedDomain,
        rootPath,
      })
    }
  }

  async importProject(sourcePath: string, traceId?: string): Promise<ProjectEntry> {
    const resolvedSource = path.resolve(sourcePath)
    const status = await this.workspaceService.readConfigStatus(resolvedSource, traceId)

    await this.ensureProjectsDir()

    if (status.status === 'ok') {
      const domain = status.config.domain
      await this.writeLinkFile(domain, resolvedSource)
      return this.toProjectEntry(domain, resolvedSource, true, traceId)
    }

    const fallbackDomain = this.deriveImportDomainFromPath(resolvedSource)
    await this.writeLinkFile(fallbackDomain, resolvedSource)
    return this.toProjectEntry(fallbackDomain, resolvedSource, true, traceId, fallbackDomain)
  }

  async getConfigStatus(id: string, traceId?: string): Promise<ProjectConfigStatus> {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    return this.workspaceService.readConfigStatus(projectPath, traceId)
  }

  async writeProjectConfig(
    id: string,
    input: WriteProjectConfigInput,
    traceId?: string,
  ): Promise<ProjectEntry> {
    const { projectPath, linked } = await this.resolveProjectPath(id, traceId)
    const configJson: VnextWorkspaceConfigJson = input

    await fs.writeFile(
      path.join(projectPath, CONFIG_FILE),
      JSON.stringify(configJson, null, 2),
      'utf-8',
    )

    if (linked) {
      if (id !== configJson.domain) {
        const oldLinkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
        try {
          await fs.unlink(oldLinkPath)
        } catch (error) {
          const code = (error as NodeJS.ErrnoException | undefined)?.code
          if (code !== 'ENOENT') {
            throw this.toProjectError(error, 'ProjectService.writeProjectConfig', traceId, {
              id,
              oldLinkPath,
            })
          }
        }
      }
      await this.writeLinkFile(configJson.domain, projectPath)
    }

    const nextId = linked ? configJson.domain : id
    return this.getProject(nextId, traceId)
  }

  async getFileTree(id: string, traceId?: string) {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    return this.workspaceService.getFileTree(projectPath, traceId)
  }

  async getConfig(id: string, traceId?: string) {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    return this.workspaceService.getConfig(projectPath, traceId)
  }

  /**
   * Proje kökünde yalnızca `vnext.config.json` dosyası var mı (başka dosya/klasör yok).
   */
  private async projectRootHasOnlyVnextConfigFile(projectPath: string): Promise<boolean> {
    const entries = await fs.readdir(projectPath, { withFileTypes: true })
    const relevant = entries.filter(
      (e) => e.name !== '.DS_Store' && e.name !== 'Thumbs.db' && e.name !== 'desktop.ini',
    )
    if (relevant.length !== 1) {
      return false
    }
    const only = relevant[0]
    return only.isFile() && only.name === CONFIG_FILE
  }

  /**
   * Geçerli config için `componentsRoot` ve `paths.*` dizinlerinin diskte varlığını kontrol eder.
   */
  async getVnextComponentLayoutStatus(
    id: string,
    traceId?: string,
  ): Promise<VnextComponentLayoutStatusResult> {
    const { path: projectPath } = await this.getProject(id, traceId)
    const status = await this.workspaceService.readConfigStatus(projectPath, traceId)

    if (status.status !== 'ok') {
      const message =
        status.status === 'missing'
          ? 'vnext.config.json bulunamadı.'
          : status.status === 'invalid'
            ? status.message
            : 'Proje yapılandırması okunamadı.'
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

    const [projectContainsOnlyConfigFile, dirs] = await Promise.all([
      this.projectRootHasOnlyVnextConfigFile(projectPath),
      Promise.resolve(this.collectComponentLayoutDirectories(projectPath, status.config.paths, traceId)),
    ])

    const missingLayoutPaths: string[] = []
    for (const dir of dirs) {
      const rel = this.toProjectRelativePosixPath(projectPath, dir)
      try {
        const st = await fs.stat(dir)
        if (!st.isDirectory()) {
          missingLayoutPaths.push(rel)
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code
        if (code === 'ENOENT') {
          missingLayoutPaths.push(rel)
        } else {
          throw this.toProjectError(error, 'ProjectService.getVnextComponentLayoutStatus', traceId, {
            id,
            dir,
          })
        }
      }
    }

    const componentsRootResolved = dirs[0]
    let componentsRootPresent = false
    if (componentsRootResolved) {
      try {
        const st = await fs.stat(componentsRootResolved)
        componentsRootPresent = st.isDirectory()
      } catch {
        componentsRootPresent = false
      }
    }

    const layoutComplete = missingLayoutPaths.length === 0

    return {
      projectContainsOnlyConfigFile,
      componentsRootPresent,
      missingLayoutPaths,
      layoutComplete,
    }
  }

  /**
   * vnext.config.json içindeki `paths.componentsRoot` ve bileşen yollarına göre klasör iskeleti oluşturur
   * (`createProject` içindeki `getComponentPaths` yerine yapılandırmaya dayalı).
   */
  async seedVnextComponentLayoutFromConfig(
    id: string,
    traceId?: string,
  ): Promise<SeedVnextComponentLayoutResult> {
    const { path: projectPath } = await this.getProject(id, traceId)
    const status = await this.workspaceService.readConfigStatus(projectPath, traceId)

    if (status.status !== 'ok') {
      const message =
        status.status === 'missing'
          ? 'vnext.config.json bulunamadı.'
          : status.status === 'invalid'
            ? status.message
            : 'Proje yapılandırması okunamadı.'
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

    const dirs = this.collectComponentLayoutDirectories(projectPath, status.config.paths, traceId)
    const ensuredPaths: string[] = []
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true })
      ensuredPaths.push(this.toProjectRelativePosixPath(projectPath, dir))
    }

    return { ensuredPaths }
  }

  private deriveImportDomainFromPath(resolvedSource: string): string {
    const base = path.basename(resolvedSource).trim() || 'workspace'
    const cleaned = base.replace(/[\\/:*?"<>|]/g, '-').replace(/^\.+/, '') || 'workspace'
    const reserved =
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(cleaned) || cleaned === '.' || cleaned === '..'
    const candidate = reserved ? `${cleaned}-workspace` : cleaned
    if (candidate.length > 120) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'Klasör adından türetilen proje alanı adı çok uzun',
        {
          source: 'ProjectService.deriveImportDomainFromPath',
          layer: 'application',
          details: { resolvedSource, candidate },
        },
        undefined,
      )
    }
    return candidate
  }

  async exportProject(
    id: string,
    targetPath: string,
    traceId?: string,
  ): Promise<{ success: true; exportPath: string }> {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    try {
      await fs.cp(projectPath, targetPath, { recursive: true })
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

  async removeProject(id: string, traceId?: string): Promise<{ success: boolean }> {
    await this.ensureProjectsDir()
    const linkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
    try {
      await fs.unlink(linkPath)
      return { success: true }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code && code !== 'ENOENT') {
        throw this.toProjectError(error, 'ProjectService.removeProject', traceId, { id, linkPath })
      }
    }
    const directPath = path.join(PROJECTS_DIR, id)
    try {
      await fs.rm(directPath, { recursive: true })
      return { success: true }
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.removeProject', traceId, { id, directPath })
    }
  }

  private collectComponentLayoutDirectories(
    projectRoot: string,
    paths: WorkspacePaths,
    traceId?: string,
  ): string[] {
    const componentsRoot = paths.componentsRoot.trim()
    if (!componentsRoot) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'paths.componentsRoot boş olamaz.',
        {
          source: 'ProjectService.collectComponentLayoutDirectories',
          layer: 'application',
        },
        traceId,
      )
    }
    if (path.isAbsolute(componentsRoot)) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'paths.componentsRoot mutlak yol olamaz.',
        {
          source: 'ProjectService.collectComponentLayoutDirectories',
          layer: 'application',
          details: { componentsRoot },
        },
        traceId,
      )
    }

    const resolved: string[] = []
    const baseResolved = path.resolve(path.join(projectRoot, componentsRoot))
    this.assertResolvedPathInsideProject(projectRoot, baseResolved, traceId)
    resolved.push(baseResolved)

    for (const key of COMPONENT_LAYOUT_PATH_KEYS) {
      const segment = paths[key].trim()
      if (!segment) continue
      if (path.isAbsolute(segment)) {
        throw new VnextForgeError(
          ERROR_CODES.PROJECT_INVALID_CONFIG,
          `paths.${String(key)} mutlak yol olamaz.`,
          {
            source: 'ProjectService.collectComponentLayoutDirectories',
            layer: 'application',
            details: { key, segment },
          },
          traceId,
        )
      }
      const full = path.resolve(path.join(projectRoot, componentsRoot, segment))
      this.assertResolvedPathInsideProject(projectRoot, full, traceId)
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

  private assertResolvedPathInsideProject(
    projectRoot: string,
    targetAbsolute: string,
    traceId?: string,
  ): void {
    const root = path.resolve(projectRoot)
    const target = path.resolve(targetAbsolute)
    const relative = path.relative(root, target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'vnext.config.json yolları proje kökünün dışına çıkamaz.',
        {
          source: 'ProjectService.assertResolvedPathInsideProject',
          layer: 'application',
          details: { projectRoot: root, target },
        },
        traceId,
      )
    }
  }

  private toProjectRelativePosixPath(projectRoot: string, absoluteDir: string): string {
    const rel = path.relative(path.resolve(projectRoot), path.resolve(absoluteDir))
    if (rel === '') {
      return '.'
    }
    return rel.split(path.sep).join('/')
  }

  private async writeLinkFile(domain: string, sourcePath: string): Promise<void> {
    const linkFile: LinkFile = { sourcePath, domain, importedAt: new Date().toISOString() }
    await fs.writeFile(
      path.join(PROJECTS_DIR, `${domain}.link.json`),
      JSON.stringify(linkFile, null, 2),
      'utf-8',
    )
  }

  private async toProjectEntry(
    id: string,
    rootPath: string,
    linked: boolean,
    traceId?: string,
    fallbackDomain?: string,
  ): Promise<ProjectEntry> {
    try {
      const config = await this.workspaceService.getConfig(rootPath, traceId)
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

  private toProjectError(
    error: unknown,
    source: string,
    traceId?: string,
    details?: Record<string, unknown>,
  ): VnextForgeError {
    if (error instanceof VnextForgeError) return error
    const code = (error as NodeJS.ErrnoException | undefined)?.code

    if (code === 'ENOENT') {
      return new VnextForgeError(
        ERROR_CODES.PROJECT_NOT_FOUND,
        'Project was not found',
        { source, layer: 'application', details },
        traceId,
      )
    }
    if (code === 'EEXIST') {
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
}
