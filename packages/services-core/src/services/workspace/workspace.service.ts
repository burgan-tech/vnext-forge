import { buildVnextWorkspaceConfig, ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import { z } from 'zod'

import type { FileSystemAdapter, LoggerAdapter } from '../../adapters/index.js'
import { toFileVnextError } from '../../internal/errno.js'
import { joinPosix, relativePosix, toPosix } from '../../internal/paths.js'
import { CONFIG_FILE } from './constants.js'
import { createWorkspaceAnalyzer, type WorkspaceAnalyzer } from './workspace-analyzer.js'
import type {
  DirectoryEntry,
  FileTreeNode,
  SearchResult,
  VnextWorkspaceConfig,
  WorkspaceAnalysisResult,
  WorkspaceConfigReadStatus,
  WorkspaceStructure,
} from './types.js'

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

function matchesGlobPattern(filePath: string, pattern: string): boolean {
  const segments = pattern.split(',').map((p) => p.trim()).filter(Boolean)
  return segments.some((seg) => matchSingleGlob(filePath, seg))
}

function matchSingleGlob(filePath: string, pattern: string): boolean {
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

// ── Zod schemas (used by methodRegistry; live next to the service) ───────────

export const filesReadParams = z.object({ path: z.string().min(1) })
export const filesReadResult = z.object({ content: z.string() })

export const filesWriteParams = z.object({
  path: z.string().min(1),
  content: z.string(),
})
export const filesWriteResult = z.null()

export const filesDeleteParams = z.object({ path: z.string().min(1) })
export const filesDeleteResult = z.null()

export const filesMkdirParams = z.object({ path: z.string().min(1) })
export const filesMkdirResult = z.null()

export const filesRenameParams = z.object({
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
})
export const filesRenameResult = z.null()

export const filesBrowseParams = z
  .object({
    path: z.string().optional(),
  })
  .optional()
  .transform((v) => v ?? {})

export const filesBrowseResult = z.object({
  path: z.string(),
  folders: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      type: z.enum(['file', 'directory']),
    }),
  ),
})

export const filesSearchParams = z.object({
  project: z.string().min(1),
  q: z.string().min(1),
  matchCase: z.boolean().optional(),
  matchWholeWord: z.boolean().optional(),
  useRegex: z.boolean().optional(),
  include: z.string().optional(),
  exclude: z.string().optional(),
})
export const filesSearchResult = z.array(
  z.object({
    path: z.string(),
    line: z.number().int(),
    text: z.string(),
  }),
)

// ── Service factory ───────────────────────────────────────────────────────────

export interface WorkspaceServiceDeps {
  fs: FileSystemAdapter
  logger: LoggerAdapter
}

export function createWorkspaceService(deps: WorkspaceServiceDeps) {
  const { fs } = deps
  const analyzer: WorkspaceAnalyzer = createWorkspaceAnalyzer({ fs })

  async function readFile(filePath: string, traceId?: string): Promise<string> {
    try {
      return await fs.readFile(filePath)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.readFile', traceId, { filePath })
    }
  }

  async function writeFile(filePath: string, content: string, traceId?: string): Promise<void> {
    try {
      const dir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
      if (dir) await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath, content)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.writeFile', traceId, { filePath }, ERROR_CODES.FILE_WRITE_ERROR)
    }
  }

  async function deleteFile(filePath: string, traceId?: string): Promise<void> {
    try {
      await fs.rmrf(filePath)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.deleteFile', traceId, { filePath }, ERROR_CODES.FILE_DELETE_ERROR)
    }
  }

  async function createDirectory(dirPath: string, traceId?: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.createDirectory', traceId, { dirPath }, ERROR_CODES.FILE_WRITE_ERROR)
    }
  }

  async function renameFile(oldPath: string, newPath: string, traceId?: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.renameFile', traceId, { oldPath, newPath }, ERROR_CODES.FILE_WRITE_ERROR)
    }
  }

  async function searchFiles(
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
      await searchDir(projectPath, projectPath, matcher, options, results, traceId)
      return results.slice(0, 100)
    } catch (error) {
      if (error instanceof VnextForgeError) throw error
      throw toFileVnextError(error, 'WorkspaceService.searchFiles', traceId, { projectPath, query })
    }
  }

  async function searchDir(
    dirPath: string,
    projectRoot: string,
    matcher: RegExp,
    options: { include?: string; exclude?: string },
    results: SearchResult[],
    traceId: string | undefined,
  ): Promise<void> {
    let entries
    try {
      entries = await fs.readDir(dirPath)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.searchDir', traceId, { dirPath })
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = joinPosix(dirPath, entry.name)
      const relPath = relativePosix(projectRoot, fullPath)

      if (entry.isDirectory) {
        if (options.exclude && matchesGlobPattern(relPath, options.exclude)) continue
        await searchDir(fullPath, projectRoot, matcher, options, results, traceId)
      } else if (/\.(json|csx|ts|js|md)$/.test(entry.name)) {
        if (options.exclude && matchesGlobPattern(relPath, options.exclude)) continue
        if (options.include && !matchesGlobPattern(relPath, options.include)) continue

        try {
          const content = await fs.readFile(fullPath)
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            matcher.lastIndex = 0
            if (matcher.test(lines[i])) {
              results.push({ path: fullPath, line: i + 1, text: lines[i].trim() })
              if (results.length >= 100) return
            }
          }
        } catch {
          /* unreadable file, skip */
        }
      }
      if (results.length >= 100) return
    }
  }

  async function browseDirs(
    dirPath: string | undefined,
    traceId?: string,
  ): Promise<DirectoryEntry[]> {
    let target = dirPath
    if (target === SYSTEM_ROOT_TOKEN) {
      if (fs.isWindows) return listWindowsDrives(traceId)
      target = '/'
    }
    if (!target) {
      target = fs.isWindows ? fs.resolveHome() : '/'
    }

    try {
      const entries = await fs.readDir(target)
      return entries
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => ({
          name: entry.name,
          path: joinPosix(target!, entry.name),
          type: entry.isDirectory ? ('directory' as const) : ('file' as const),
        }))
        .sort((left, right) => {
          if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
          return left.name.localeCompare(right.name)
        })
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.browseDirs', traceId, { dirPath: target })
    }
  }

  async function listWindowsDrives(traceId?: string): Promise<DirectoryEntry[]> {
    const driveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const drives = await Promise.all(
      driveLetters.map(async (letter) => {
        const drivePath = `${letter}:\\`
        try {
          const exists = await fs.exists(drivePath)
          if (!exists) return null
          return { name: `${letter}:`, path: drivePath, type: 'directory' as const }
        } catch (error) {
          throw toFileVnextError(error, 'WorkspaceService.listWindowsDrives', traceId, { drivePath })
        }
      }),
    )
    return drives.filter((d): d is NonNullable<typeof d> => d !== null)
  }

  async function getConfig(rootPath: string, traceId?: string): Promise<VnextWorkspaceConfig> {
    return analyzer.readConfig(rootPath, traceId)
  }

  async function readConfigStatus(
    rootPath: string,
    traceId?: string,
  ): Promise<WorkspaceConfigReadStatus> {
    return analyzer.readConfigStatus(rootPath, traceId)
  }

  async function getFileTree(rootPath: string, traceId?: string): Promise<WorkspaceStructure> {
    return { root: await analyzer.buildTree(rootPath, traceId) }
  }

  async function analyze(rootPath: string, traceId?: string): Promise<WorkspaceAnalysisResult> {
    return analyzer.analyze(rootPath, traceId)
  }

  function createDefaultConfig(domain: string, description?: string): VnextWorkspaceConfig {
    const normalizedDomain = domain.trim()
    const desc = description?.trim() || `${normalizedDomain} domain configuration`
    return buildVnextWorkspaceConfig({
      domain: normalizedDomain,
      description: desc,
      exportsMetadataDescription: `Exported components for ${normalizedDomain} domain`,
    })
  }

  function getConfigPath(rootPath: string): string {
    return joinPosix(rootPath, CONFIG_FILE)
  }

  return {
    readFile,
    writeFile,
    deleteFile,
    createDirectory,
    renameFile,
    searchFiles,
    browseDirs,
    getConfig,
    readConfigStatus,
    getFileTree,
    analyze,
    createDefaultConfig,
    getConfigPath,
  }
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>

// ── exported for the methodRegistry / dispatch helpers ────────────────────────

export type FileTreeNodeOut = FileTreeNode
export type WorkspaceStructureOut = WorkspaceStructure
export type DirectoryEntryOut = DirectoryEntry
export type SearchResultOut = SearchResult

void toPosix // re-export-friendly tree-shake hint (no-op)
