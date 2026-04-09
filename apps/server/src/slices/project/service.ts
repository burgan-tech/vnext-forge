import fs from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import { CONFIG_FILE } from '@workspace/constants.js'
import { WorkspaceService } from '@workspace/service.js'
import type { ProjectEntry, LinkFile } from './types.js'

const PROJECTS_DIR = path.join(homedir(), 'vnext-projects')

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
    const rootPath = targetPath ? path.resolve(targetPath, domain) : path.join(PROJECTS_DIR, domain)

    try {
      await fs.access(rootPath)
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_ALREADY_EXISTS,
        'Project already exists',
        { source: 'ProjectService.createProject', layer: 'application', details: { domain, rootPath } },
        traceId,
      )
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (error instanceof VnextForgeError) throw error
      if (code && code !== 'ENOENT') {
        throw this.toProjectError(error, 'ProjectService.createProject', traceId, { domain, rootPath })
      }
    }

    try {
      await fs.mkdir(rootPath, { recursive: true })
      for (const componentPath of this.workspaceService.getComponentPaths(rootPath, domain)) {
        await fs.mkdir(componentPath, { recursive: true })
      }
      const config = this.workspaceService.createDefaultConfig(domain, description)
      await fs.writeFile(
        this.workspaceService.getConfigPath(rootPath),
        JSON.stringify(config, null, 2),
        'utf-8',
      )
      if (targetPath) {
        await this.writeLinkFile(domain, rootPath)
        return this.toProjectEntry(domain, rootPath, true, traceId)
      }
      return this.toProjectEntry(domain, rootPath, false, traceId)
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.createProject', traceId, { domain, rootPath })
    }
  }

  async importProject(sourcePath: string, traceId?: string): Promise<ProjectEntry> {
    const resolvedSource = path.resolve(sourcePath)
    let config
    try {
      config = await this.workspaceService.getConfig(resolvedSource, traceId)
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.importProject', traceId, { sourcePath: resolvedSource })
    }

    if (!config.domain) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'Workspace config must define a domain',
        {
          source: 'ProjectService.importProject',
          layer: 'application',
          details: { sourcePath: resolvedSource, configPath: path.join(resolvedSource, CONFIG_FILE) },
        },
        traceId,
      )
    }

    await this.ensureProjectsDir()
    await this.writeLinkFile(config.domain, resolvedSource)
    return this.toProjectEntry(config.domain, resolvedSource, true, traceId)
  }

  async getFileTree(id: string, traceId?: string) {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    return this.workspaceService.getFileTree(projectPath, traceId)
  }

  async getConfig(id: string, traceId?: string) {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    return this.workspaceService.getConfig(projectPath, traceId)
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
        rootPath,
        version: config.version,
        linked,
      }
    } catch {
      return { id, domain: fallbackDomain || id, rootPath, linked }
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
