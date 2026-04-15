import fs from 'node:fs/promises'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import { homedir, platform } from 'node:os'
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import { COMPONENT_DIRS, CONFIG_FILE } from './constants.js'
import type {
  DirectoryEntry,
  SearchResult,
  WorkspaceAnalysisResult,
  WorkspaceConfig,
  WorkspaceStructure,
} from './types.js'
import { WorkspaceAnalyzer } from './workspace-analyzer.js'

const SYSTEM_ROOT_TOKEN = '::system-root::'

function buildSearchMatcher(
  query: string,
  options: { matchCase?: boolean; matchWholeWord?: boolean; useRegex?: boolean },
): RegExp {
  let pattern = options.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (options.matchWholeWord) pattern = `\\b${pattern}\\b`
  const flags = options.matchCase ? 'g' : 'gi'
  return new RegExp(pattern, flags)
}

/**
 * Minimal glob pattern matcher supporting `*`, `**`, and `?` wildcards.
 * Patterns like `**\/*.json`, `*.ts`, `src/**` are handled correctly.
 */
function matchesGlobPattern(filePath: string, pattern: string): boolean {
  const segments = pattern.split(',').map((p) => p.trim()).filter(Boolean)
  return segments.some((seg) => matchSingleGlob(filePath, seg))
}

function matchSingleGlob(filePath: string, pattern: string): boolean {
  // Escape regex special chars except * and ?
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '.*')
  try {
    return new RegExp(`^${regexStr}$`).test(filePath)
  } catch {
    return false
  }
}

function toDirectoryEntry(dirPath: string, entry: Dirent): DirectoryEntry {
  return {
    name: entry.name,
    path: path.join(dirPath, entry.name),
    type: entry.isDirectory() ? 'directory' : 'file',
  }
}

export class WorkspaceService {
  private readonly analyzer = new WorkspaceAnalyzer()

  // ── File operations ───────────────────────────────────────────────────────────

  async readFile(filePath: string, traceId?: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.readFile', traceId, { filePath })
    }
  }

  async writeFile(filePath: string, content: string, traceId?: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.writeFile', traceId, { filePath })
    }
  }

  async deleteFile(filePath: string, traceId?: string): Promise<void> {
    try {
      await fs.rm(filePath, { recursive: true })
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.deleteFile', traceId, { filePath })
    }
  }

  async createDirectory(dirPath: string, traceId?: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.createDirectory', traceId, { dirPath })
    }
  }

  async renameFile(oldPath: string, newPath: string, traceId?: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath)
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.renameFile', traceId, { oldPath, newPath })
    }
  }

  async searchFiles(
    projectPath: string,
    query: string,
    options: {
      matchCase?: boolean
      matchWholeWord?: boolean
      useRegex?: boolean
      include?: string
      exclude?: string
    } = {},
    traceId?: string,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    let matcher: RegExp
    try {
      matcher = buildSearchMatcher(query, options)
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.FILE_READ_ERROR,
        'Invalid regular expression in search query',
        { source: 'WorkspaceService.searchFiles', layer: 'infrastructure' },
        traceId,
      )
    }
    try {
      await this.searchDir(projectPath, projectPath, matcher, options, results, traceId)
      return results.slice(0, 100)
    } catch (error) {
      if (error instanceof VnextForgeError) throw error
      throw this.toFileError(error, 'WorkspaceService.searchFiles', traceId, { projectPath, query })
    }
  }

  async browseDirs(dirPath?: string, traceId?: string): Promise<DirectoryEntry[]> {
    if (dirPath === SYSTEM_ROOT_TOKEN) {
      if (platform() === 'win32') {
        return this.listWindowsDrives(traceId)
      }

      dirPath = path.parse(process.cwd()).root
    }

    if (!dirPath) {
      dirPath = platform() === 'win32' ? homedir() : path.parse(process.cwd()).root
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => toDirectoryEntry(dirPath, entry))
        .sort((left, right) => {
          if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
          return left.name.localeCompare(right.name)
        })
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.browseDirs', traceId, { dirPath })
    }
  }

  private async listWindowsDrives(traceId?: string): Promise<DirectoryEntry[]> {
    const driveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const drives = await Promise.all(
      driveLetters.map(async (letter) => {
        const drivePath = `${letter}:\\`

        try {
          await fs.access(drivePath)

          return {
            name: `${letter}:`,
            path: drivePath,
            type: 'directory' as const,
          }
        } catch (error) {
          const code = (error as NodeJS.ErrnoException | undefined)?.code
          if (code === 'ENOENT' || code === 'EACCES' || code === 'EPERM') {
            return null
          }

          throw this.toFileError(error, 'WorkspaceService.listWindowsDrives', traceId, {
            drivePath,
          })
        }
      }),
    )

    const availableDrives: DirectoryEntry[] = []

    for (const drive of drives) {
      if (drive) {
        availableDrives.push(drive)
      }
    }

    return availableDrives
  }

  // ── Workspace (project directory) operations ──────────────────────────────────

  async analyze(rootPath: string, traceId?: string): Promise<WorkspaceAnalysisResult> {
    return this.analyzer.analyze(rootPath, traceId)
  }

  async getConfig(rootPath: string, traceId?: string): Promise<WorkspaceConfig> {
    return this.analyzer.readConfig(rootPath, traceId)
  }

  async getFileTree(rootPath: string, traceId?: string): Promise<WorkspaceStructure> {
    return { root: await this.analyzer.buildTree(rootPath, traceId) }
  }

  createDefaultConfig(domain: string, description?: string): WorkspaceConfig {
    return {
      domain,
      description,
      version: '1.0.0',
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
      dependencies: { domains: [], npm: [] },
      referenceResolution: { enabled: true, validateOnBuild: true, strictMode: false },
    }
  }

  getConfigPath(rootPath: string): string {
    return path.join(rootPath, CONFIG_FILE)
  }

  getComponentPaths(rootPath: string, domain: string): string[] {
    return COMPONENT_DIRS.map((component) => path.join(rootPath, domain, component))
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async searchDir(
    dirPath: string,
    projectRoot: string,
    matcher: RegExp,
    options: { include?: string; exclude?: string },
    results: SearchResult[],
    traceId?: string,
  ): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true })
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.searchDir', traceId, { dirPath })
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = path.join(dirPath, entry.name)
      const relPath = path.relative(projectRoot, fullPath).replace(/\\/g, '/')

      if (entry.isDirectory()) {
        if (options.exclude && matchesGlobPattern(relPath, options.exclude)) continue
        await this.searchDir(fullPath, projectRoot, matcher, options, results, traceId)
      } else if (/\.(json|csx|ts|js|md)$/.test(entry.name)) {
        if (options.exclude && matchesGlobPattern(relPath, options.exclude)) continue
        if (options.include && !matchesGlobPattern(relPath, options.include)) continue

        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            matcher.lastIndex = 0
            if (matcher.test(lines[i])) {
              results.push({ path: fullPath, line: i + 1, text: lines[i].trim() })
              if (results.length >= 100) return
            }
          }
        } catch {
          // Skip unreadable or binary files.
        }
      }
      if (results.length >= 100) return
    }
  }

  private toFileError(
    error: unknown,
    source: string,
    traceId?: string,
    details?: Record<string, unknown>,
  ): VnextForgeError {
    if (error instanceof VnextForgeError) return error
    const code = (error as NodeJS.ErrnoException | undefined)?.code

    if (code === 'ENOENT') {
      return new VnextForgeError(
        ERROR_CODES.FILE_NOT_FOUND,
        'Requested file or directory was not found',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return new VnextForgeError(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        'Insufficient permissions for file system operation',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }

    const fallbackCode =
      source.includes('delete') || source.includes('Delete')
        ? ERROR_CODES.FILE_DELETE_ERROR
        : source.includes('write') ||
            source.includes('Write') ||
            source.includes('create') ||
            source.includes('Create') ||
            source.includes('rename') ||
            source.includes('Rename')
          ? ERROR_CODES.FILE_WRITE_ERROR
          : ERROR_CODES.FILE_READ_ERROR

    return new VnextForgeError(
      fallbackCode,
      error instanceof Error ? error.message : 'File system operation failed',
      { source, layer: 'infrastructure', details },
      traceId,
    )
  }
}
