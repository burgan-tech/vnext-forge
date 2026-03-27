import fs from 'node:fs/promises'
import path from 'node:path'

const PROJECTS_DIR = path.join(process.env.HOME || '~', 'vnext-projects')

export interface ProjectInfo {
  id: string;
  domain: string;
  description?: string;
  path: string;
  version?: string;
  workflowCount?: number;
  linked?: boolean;
}

export interface LinkFile {
  sourcePath: string;
  domain: string;
  importedAt: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export class ProjectService {
  async ensureProjectsDir() {
    await fs.mkdir(PROJECTS_DIR, { recursive: true })
  }

  /**
   * Resolve the actual filesystem path for a project.
   * If a .link.json file exists, read sourcePath from it.
   * Otherwise, use the direct directory path.
   */
  async resolveProjectPath(id: string): Promise<{ projectPath: string; linked: boolean }> {
    // Check for link file first
    const linkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
    try {
      const linkRaw = await fs.readFile(linkPath, 'utf-8')
      const link: LinkFile = JSON.parse(linkRaw)
      return { projectPath: link.sourcePath, linked: true }
    } catch {
      // No link file, use direct path
      const directPath = path.join(PROJECTS_DIR, id)
      return { projectPath: directPath, linked: false }
    }
  }

  async listProjects(): Promise<ProjectInfo[]> {
    await this.ensureProjectsDir()
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
    const projects: ProjectInfo[] = []
    const seenIds = new Set<string>()

    // Scan .link.json files (referenced/imported projects)
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.link.json')) continue
      const id = entry.name.replace('.link.json', '')
      seenIds.add(id)

      try {
        const linkRaw = await fs.readFile(path.join(PROJECTS_DIR, entry.name), 'utf-8')
        const link: LinkFile = JSON.parse(linkRaw)
        const configPath = path.join(link.sourcePath, 'vnext.config.json')
        try {
          const configRaw = await fs.readFile(configPath, 'utf-8')
          const config = JSON.parse(configRaw)
          projects.push({
            id,
            domain: config.domain || id,
            description: config.description,
            path: link.sourcePath,
            version: config.version,
            linked: true,
          })
        } catch {
          projects.push({
            id,
            domain: link.domain || id,
            path: link.sourcePath,
            linked: true,
          })
        }
      } catch {
        // Invalid link file, skip
      }
    }

    // Scan direct directories
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (seenIds.has(entry.name)) continue
      const projectPath = path.join(PROJECTS_DIR, entry.name)
      const configPath = path.join(projectPath, 'vnext.config.json')
      try {
        const configRaw = await fs.readFile(configPath, 'utf-8')
        const config = JSON.parse(configRaw)
        projects.push({
          id: entry.name,
          domain: config.domain || entry.name,
          description: config.description,
          path: projectPath,
          version: config.version,
          linked: false,
        })
      } catch {
        projects.push({
          id: entry.name,
          domain: entry.name,
          path: projectPath,
          linked: false,
        })
      }
    }

    return projects
  }

  async getProject(id: string): Promise<ProjectInfo> {
    const { projectPath, linked } = await this.resolveProjectPath(id)
    const stat = await fs.stat(projectPath)
    if (!stat.isDirectory()) throw new Error('Project not found')

    const configPath = path.join(projectPath, 'vnext.config.json')
    try {
      const configRaw = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configRaw)
      return {
        id,
        domain: config.domain || id,
        description: config.description,
        path: projectPath,
        version: config.version,
        linked,
      }
    } catch {
      return { id, domain: id, path: projectPath, linked }
    }
  }

  async createProject(domain: string, description?: string, targetPath?: string): Promise<ProjectInfo> {
    await this.ensureProjectsDir()
    // If targetPath provided, create there and link back; otherwise use default dir
    const projectPath = targetPath ? path.resolve(targetPath, domain) : path.join(PROJECTS_DIR, domain)
    await fs.mkdir(projectPath, { recursive: true })

    const componentsDirs = ['Workflows', 'Mappings', 'Schemas', 'Tasks', 'Views', 'Functions', 'Extensions']
    for (const dir of componentsDirs) {
      await fs.mkdir(path.join(projectPath, domain, dir), { recursive: true })
    }

    const config = {
      version: '1.0.0',
      description: description || '',
      domain,
      runtimeVersion: '0.0.33',
      schemaVersion: '0.0.33',
      paths: {
        componentsRoot: domain,
        tasks: 'Tasks',
        views: 'Views',
        functions: 'Functions',
        extensions: 'Extensions',
        workflows: 'Workflows',
        schemas: 'Schemas',
        mappings: 'Mappings',
      },
      exports: {
        functions: [],
        workflows: [],
        tasks: [],
        views: [],
        schemas: [],
        extensions: [],
        visibility: 'private',
        metadata: {},
      },
      dependencies: {
        domains: [],
        npm: [],
      },
      referenceResolution: {
        enabled: true,
        validateOnBuild: true,
        strictMode: false,
      },
    }

    await fs.writeFile(
      path.join(projectPath, 'vnext.config.json'),
      JSON.stringify(config, null, 2)
    )

    // If created outside default dir, create a link file so it appears in project list
    if (targetPath) {
      const linkFile: LinkFile = {
        sourcePath: projectPath,
        domain,
        importedAt: new Date().toISOString(),
      }
      const linkPath = path.join(PROJECTS_DIR, `${domain}.link.json`)
      await fs.writeFile(linkPath, JSON.stringify(linkFile, null, 2))
      return { id: domain, domain, description, path: projectPath, version: '1.0.0', linked: true }
    }

    return { id: domain, domain, description, path: projectPath, version: '1.0.0', linked: false }
  }

  async importProject(sourcePath: string): Promise<ProjectInfo> {
    const resolvedSource = path.resolve(sourcePath)
    const configPath = path.join(resolvedSource, 'vnext.config.json')
    const configRaw = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(configRaw)
    const domain = config.domain

    if (!domain) {
      throw new Error('vnext.config.json must have a "domain" field')
    }

    await this.ensureProjectsDir()

    // Write a link file instead of copying the project
    const linkFile: LinkFile = {
      sourcePath: resolvedSource,
      domain,
      importedAt: new Date().toISOString(),
    }

    const linkPath = path.join(PROJECTS_DIR, `${domain}.link.json`)
    await fs.writeFile(linkPath, JSON.stringify(linkFile, null, 2))

    return {
      id: domain,
      domain,
      description: config.description,
      path: resolvedSource,
      version: config.version,
      linked: true,
    }
  }

  async getFileTree(id: string): Promise<FileTreeNode> {
    const { projectPath } = await this.resolveProjectPath(id)
    return this.buildTree(projectPath, id)
  }

  private async buildTree(dirPath: string, name: string): Promise<FileTreeNode> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const children: FileTreeNode[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        children.push(await this.buildTree(fullPath, entry.name))
      } else {
        children.push({ name: entry.name, path: fullPath, type: 'file' })
      }
    }

    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return { name, path: dirPath, type: 'directory', children }
  }

  async getConfig(id: string) {
    const { projectPath } = await this.resolveProjectPath(id)
    const configPath = path.join(projectPath, 'vnext.config.json')
    const raw = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(raw)
  }

  async exportProject(id: string, targetPath: string) {
    const { projectPath } = await this.resolveProjectPath(id)
    await fs.cp(projectPath, targetPath, { recursive: true })
    return { success: true, exportPath: targetPath }
  }

  async removeProject(id: string): Promise<{ success: boolean }> {
    await this.ensureProjectsDir()
    // Only remove the link file, never delete the actual project files
    const linkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
    try {
      await fs.unlink(linkPath)
      return { success: true }
    } catch {
      // Try removing direct directory
      const dirPath = path.join(PROJECTS_DIR, id)
      await fs.rm(dirPath, { recursive: true })
      return { success: true }
    }
  }
}
