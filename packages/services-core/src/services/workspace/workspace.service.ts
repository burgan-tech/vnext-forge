import { Buffer } from 'node:buffer'

import { buildVnextWorkspaceConfig, ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import ignore from 'ignore'
import picomatch from 'picomatch'
import { z } from 'zod'

import type { FileSystemAdapter, LoggerAdapter } from '../../adapters/index.js'
import { toFileVnextError } from '../../internal/errno.js'
import { basename, joinPosix, joinWithSeparator, relativePosix, toPosix } from '../../internal/paths.js'
import type { PathPolicy } from '../../internal/path-policy.js'
import { CONFIG_FILE } from './constants.js'
import {
  collectRipgrepSearch,
  getRipgrepExecutablePath,
  runRipgrepSearchJsonStream,
} from './workspace-search-ripgrep.js'
import { createWorkspaceAnalyzer, type WorkspaceAnalyzer } from './workspace-analyzer.js'
import type {
  DirectoryEntry,
  FileSearchHit,
  FileSearchResponse,
  FileTreeNode,
  SearchResult,
  VnextWorkspaceConfig,
  WorkspaceAnalysisResult,
  WorkspaceConfigReadStatus,
  WorkspaceStructure,
} from './types.js'

const SYSTEM_ROOT_TOKEN = '::system-root::'

const SEARCH_CURSOR_VERSION = 1 as const
const DEFAULT_SEARCH_LIMIT = 200
const MAX_SEARCH_LIMIT = 1000
const MAX_SCAN_MATCHES = 50_000
const MAX_SEARCH_FILE_BYTES = 4 * 1024 * 1024

const SKIP_SEARCH_DIR_NAMES = new Set(['node_modules', '.git', '.svn', '.hg'])

const BINARY_FILE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'bmp',
  'tif',
  'tiff',
  'heic',
  'avif',
  'heif',
  'pdf',
  'zip',
  'gz',
  'tar',
  'bz2',
  '7z',
  'rar',
  'xz',
  'br',
  'zst',
  'wasm',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'dmg',
  'iso',
  'apk',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'otf',
  'mp3',
  'mp4',
  'webm',
  'avi',
  'mov',
  'mkv',
  'm4a',
  'flac',
  'ogg',
  'opus',
  'wav',
  'aiff',
  'class',
  'jar',
  'aar',
  'dex',
  'o',
  'obj',
  'a',
  'lib',
  'pdb',
  'ilk',
  'pyc',
  'pyo',
  'pyd',
  'sqlite',
  'db',
  'mdb',
  'psd',
  'blend',
  'sketch',
])

function buildSearchMatcher(
  query: string,
  options: { matchCase?: boolean; matchWholeWord?: boolean; useRegex?: boolean },
): RegExp {
  let pattern = options.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (options.matchWholeWord) pattern = `\\b${pattern}\\b`
  const flags = options.matchCase ? 'g' : 'gi'
  return new RegExp(pattern, flags)
}

function fileExtensionLower(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

function isBinaryExtensionFileName(fileName: string): boolean {
  const ext = fileExtensionLower(fileName)
  return ext !== '' && BINARY_FILE_EXTENSIONS.has(ext)
}

function normalizeGlobPatternList(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  const parts = Array.isArray(value) ? value : value.split(',')
  return parts.map((p) => p.trim()).filter(Boolean)
}

function compileAnyPicomatch(patterns: string[]): ((relPath: string) => boolean) | null {
  if (patterns.length === 0) return null
  const matchers = patterns.map((pattern) => picomatch(pattern, { dot: true }))
  return (relPath: string) => matchers.some((match) => match(relPath))
}

function encodeSearchCursor(nextSkip: number): string {
  return Buffer.from(JSON.stringify({ v: SEARCH_CURSOR_VERSION, s: nextSkip }), 'utf8').toString(
    'base64url',
  )
}

function decodeSearchCursor(cursor: string | undefined): number {
  if (!cursor?.trim()) return 0
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { v?: number; s?: number }
    if (parsed.v !== SEARCH_CURSOR_VERSION || typeof parsed.s !== 'number' || !Number.isFinite(parsed.s)) {
      return 0
    }
    return Math.max(0, Math.floor(parsed.s))
  } catch {
    return 0
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

const stringOrStringArray = z.union([z.string(), z.array(z.string())]).optional()

export const filesSearchParams = z
  .object({
    project: z.string().min(1).optional(),
    projectPath: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    query: z.string().optional(),
    q: z.string().optional(),
    matchCase: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
    matchWholeWord: z.boolean().optional(),
    wholeWord: z.boolean().optional(),
    useRegex: z.boolean().optional(),
    include: stringOrStringArray,
    exclude: stringOrStringArray,
    limit: z.number().int().positive().max(MAX_SEARCH_LIMIT).optional(),
    cursor: z.string().optional(),
  })
  .refine((v) => !!(v.project ?? v.projectPath ?? v.projectId), {
    message: 'Provide project, projectPath, or projectId.',
    path: ['projectPath'],
  })
  .refine((v) => !!((v.query ?? v.q ?? '').trim()), {
    message: 'Provide query or q.',
    path: ['query'],
  })
  .transform((val) => {
    const query = (val.query ?? val.q ?? '').trim()
    const caseSensitive = val.caseSensitive ?? val.matchCase ?? false
    const wholeWord = val.wholeWord ?? val.matchWholeWord ?? false
    const useRegex = val.useRegex ?? false
    const limit = val.limit ?? DEFAULT_SEARCH_LIMIT
    return {
      projectId: val.projectId,
      projectPath: val.projectPath ?? val.project ?? '',
      query,
      caseSensitive,
      wholeWord,
      useRegex,
      includePatterns: normalizeGlobPatternList(val.include),
      excludePatterns: normalizeGlobPatternList(val.exclude),
      limit,
      cursor: val.cursor,
    }
  })

export const filesSearchResult = z.object({
  items: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().positive(),
      column: z.number().int().positive(),
      text: z.string(),
      matchLength: z.number().int().nonnegative(),
    }),
  ),
  nextCursor: z.string().optional(),
  totalFiles: z.number().int().nonnegative(),
  truncated: z.boolean(),
})

// ── Service factory ───────────────────────────────────────────────────────────

export interface WorkspaceServiceDeps {
  fs: FileSystemAdapter
  logger: LoggerAdapter
  /**
   * Optional filesystem jail. When provided, every file/directory
   * operation is gated through it (see `internal/path-policy.ts`). When
   * absent the service runs in the legacy "no jail" mode used by the VS
   * Code extension shell where the user already trusts the workspace.
   */
  pathPolicy?: PathPolicy
}

export function createWorkspaceService(deps: WorkspaceServiceDeps) {
  const { fs, pathPolicy, logger } = deps
  const analyzer: WorkspaceAnalyzer = createWorkspaceAnalyzer({ fs })

  async function readFile(filePath: string, traceId?: string): Promise<string> {
    if (pathPolicy) await pathPolicy.assertReadable(filePath, traceId)
    try {
      return await fs.readFile(filePath)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.readFile', traceId, { filePath })
    }
  }

  async function writeFile(filePath: string, content: string, traceId?: string): Promise<void> {
    if (pathPolicy) await pathPolicy.assertWritable(filePath, traceId)
    try {
      const dir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
      if (dir) await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath, content)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.writeFile', traceId, { filePath }, ERROR_CODES.FILE_WRITE_ERROR)
    }
  }

  async function deleteFile(filePath: string, traceId?: string): Promise<void> {
    if (pathPolicy) await pathPolicy.assertWritable(filePath, traceId)
    try {
      await fs.rmrf(filePath)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.deleteFile', traceId, { filePath }, ERROR_CODES.FILE_DELETE_ERROR)
    }
  }

  async function createDirectory(dirPath: string, traceId?: string): Promise<void> {
    if (pathPolicy) await pathPolicy.assertWritable(dirPath, traceId)
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.createDirectory', traceId, { dirPath }, ERROR_CODES.FILE_WRITE_ERROR)
    }
  }

  async function renameFile(oldPath: string, newPath: string, traceId?: string): Promise<void> {
    if (pathPolicy) {
      await pathPolicy.assertWritable(oldPath, traceId)
      await pathPolicy.assertWritable(newPath, traceId)
    }
    try {
      await fs.rename(oldPath, newPath)
    } catch (error) {
      throw toFileVnextError(error, 'WorkspaceService.renameFile', traceId, { oldPath, newPath }, ERROR_CODES.FILE_WRITE_ERROR)
    }
  }

  async function runNodeFilesystemSearch(
    projectRoot: string,
    query: string,
    options: {
      caseSensitive?: boolean
      wholeWord?: boolean
      useRegex?: boolean
      includePatterns?: string[]
      excludePatterns?: string[]
    },
    skip: number,
    limit: number,
    traceId?: string,
  ): Promise<FileSearchResponse> {
    let matcher: RegExp
    try {
      matcher = buildSearchMatcher(query, {
        matchCase: options.caseSensitive ?? false,
        matchWholeWord: options.wholeWord ?? false,
        useRegex: options.useRegex ?? false,
      })
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.FILE_READ_ERROR,
        'Invalid regular expression in search query',
        { source: 'WorkspaceService.searchFiles', layer: 'infrastructure' },
        traceId,
      )
    }

    const includeMatcher = compileAnyPicomatch(options.includePatterns ?? [])
    const excludeMatcher = compileAnyPicomatch(options.excludePatterns ?? [])

    const gitIgnorer = ignore()
    try {
      const rules = await fs.readFile(joinPosix(projectRoot, '.gitignore'))
      if (rules.trim().length > 0) gitIgnorer.add(rules)
    } catch {
      /* optional */
    }

    const items: FileSearchResponse['items'] = []
    let totalFiles = 0
    let globalMatchIndex = 0
    let truncated = false
    let stoppedForPaging = false

    function isDirIgnored(relPath: string): boolean {
      return gitIgnorer.ignores(relPath) || gitIgnorer.ignores(`${relPath}/`)
    }

    function isFileIgnored(relPath: string): boolean {
      return gitIgnorer.ignores(relPath)
    }

    async function visitFile(fullPath: string, relPath: string): Promise<'stop' | void> {
      if (isBinaryExtensionFileName(basename(relPath))) return
      if (isFileIgnored(relPath)) return
      if (excludeMatcher?.(relPath)) return
      if (includeMatcher && !includeMatcher(relPath)) return

      if (pathPolicy) {
        try {
          await pathPolicy.assertReadable(fullPath, traceId)
        } catch {
          return
        }
      }

      let content: string
      try {
        content = await fs.readFile(fullPath)
      } catch {
        return
      }
      if (content.length > MAX_SEARCH_FILE_BYTES) return
      if (content.includes('\0')) return

      totalFiles += 1
      const lines = content.split('\n')

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]
        let matches: RegExpMatchArray[]
        try {
          matches = [...line.matchAll(matcher)]
        } catch {
          continue
        }

        const lineNumber = lineIndex + 1
        for (const m of matches) {
          if (m.index === undefined) continue
          globalMatchIndex += 1
          if (globalMatchIndex > MAX_SCAN_MATCHES) {
            truncated = true
            return 'stop'
          }

          if (globalMatchIndex <= skip) continue
          if (items.length < limit) {
            items.push({
              path: fullPath,
              line: lineNumber,
              column: m.index + 1,
              text: line,
              matchLength: m[0].length,
            })
          }

          if (items.length >= limit) {
            stoppedForPaging = true
            return 'stop'
          }
        }
      }
    }

    async function visitDirectory(dirAbsolute: string): Promise<'stop' | void> {
      let entries
      try {
        entries = await fs.readDir(dirAbsolute)
      } catch (error) {
        throw toFileVnextError(error, 'WorkspaceService.searchFiles', traceId, { dirPath: dirAbsolute })
      }

      const sorted = [...entries].sort((left, right) => {
        if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1
        return left.name.localeCompare(right.name)
      })

      for (const entry of sorted) {
        if (entry.name === '.' || entry.name === '..') continue
        const fullPath = joinPosix(dirAbsolute, entry.name)
        const relPath = relativePosix(projectRoot, fullPath)

        if (entry.isDirectory) {
          if (SKIP_SEARCH_DIR_NAMES.has(entry.name)) continue
          if (isDirIgnored(relPath)) continue
          if (excludeMatcher?.(`${relPath}/`) || excludeMatcher?.(relPath)) continue

          const sub = await visitDirectory(fullPath)
          if (sub === 'stop') return 'stop'
        } else {
          const sub = await visitFile(fullPath, relPath)
          if (sub === 'stop') return 'stop'
        }
      }
    }

    try {
      const rootStop = await visitDirectory(projectRoot)
      if (rootStop === 'stop' && truncated) {
        return { items, totalFiles, truncated, nextCursor: undefined }
      }
      const nextCursor =
        stoppedForPaging && items.length === limit && !truncated ? encodeSearchCursor(skip + limit) : undefined
      return { items, totalFiles, truncated, nextCursor }
    } catch (error) {
      if (error instanceof VnextForgeError) throw error
      throw toFileVnextError(error, 'WorkspaceService.searchFiles', traceId, {
        projectPath: projectRoot,
        query,
      })
    }
  }

  async function streamNodeFilesystemSearch(
    projectRoot: string,
    query: string,
    options: {
      caseSensitive?: boolean
      wholeWord?: boolean
      useRegex?: boolean
      includePatterns?: string[]
      excludePatterns?: string[]
      limit?: number
    },
    handlers: {
      onMatch: (hit: FileSearchHit) => void | Promise<void>
      onProgress: (scannedFiles: number) => void | Promise<void>
    },
    signal: AbortSignal | undefined,
    skip: number,
    limit: number,
    progressStride: number,
    traceId?: string,
  ): Promise<{ totalFiles: number; totalMatches: number; truncated: boolean }> {
    let matcher: RegExp
    try {
      matcher = buildSearchMatcher(query, {
        matchCase: options.caseSensitive ?? false,
        matchWholeWord: options.wholeWord ?? false,
        useRegex: options.useRegex ?? false,
      })
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.FILE_READ_ERROR,
        'Invalid regular expression in search query',
        { source: 'WorkspaceService.streamSearchFiles', layer: 'infrastructure' },
        traceId,
      )
    }

    const includeMatcher = compileAnyPicomatch(options.includePatterns ?? [])
    const excludeMatcher = compileAnyPicomatch(options.excludePatterns ?? [])

    const gitIgnorer = ignore()
    try {
      const rules = await fs.readFile(joinPosix(projectRoot, '.gitignore'))
      if (rules.trim().length > 0) gitIgnorer.add(rules)
    } catch {
      /* optional */
    }

    let totalFiles = 0
    let globalMatchIndex = 0
    let truncatedForCap = false
    let stoppedForPaging = false
    let totalMatchesEmitted = 0

    function checkSignal(): boolean {
      return !!(signal?.aborted)
    }

    async function bumpProgressMaybe(): Promise<boolean> {
      if (signal?.aborted) return false
      if (totalFiles > 0 && totalFiles % progressStride === 0) {
        await handlers.onProgress(totalFiles)
      }
      return true
    }

    function isDirIgnored(relPath: string): boolean {
      return gitIgnorer.ignores(relPath) || gitIgnorer.ignores(`${relPath}/`)
    }

    function isFileIgnored(relPath: string): boolean {
      return gitIgnorer.ignores(relPath)
    }

    async function visitFile(fullPath: string, relPath: string): Promise<'stop' | void> {
      if (checkSignal()) return 'stop'

      if (isBinaryExtensionFileName(basename(relPath))) return
      if (isFileIgnored(relPath)) return
      if (excludeMatcher?.(relPath)) return
      if (includeMatcher && !includeMatcher(relPath)) return

      if (pathPolicy) {
        try {
          await pathPolicy.assertReadable(fullPath, traceId)
        } catch {
          return
        }
      }

      let content: string
      try {
        content = await fs.readFile(fullPath)
      } catch {
        return
      }
      if (content.length > MAX_SEARCH_FILE_BYTES) return
      if (content.includes('\0')) return

      totalFiles += 1
      if (!(await bumpProgressMaybe())) return 'stop'

      const lines = content.split('\n')

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]
        let matches: RegExpMatchArray[]
        try {
          matches = [...line.matchAll(matcher)]
        } catch {
          continue
        }

        const lineNumber = lineIndex + 1
        for (const m of matches) {
          if (m.index === undefined) continue

          globalMatchIndex += 1
          if (globalMatchIndex > MAX_SCAN_MATCHES) {
            truncatedForCap = true
            return 'stop'
          }

          if (globalMatchIndex <= skip) continue

          if (totalMatchesEmitted >= limit) {
            stoppedForPaging = true
            return 'stop'
          }

          await handlers.onMatch({
            path: fullPath,
            line: lineNumber,
            column: m.index + 1,
            text: line,
            matchLength: m[0].length,
          })

          totalMatchesEmitted += 1

          if (checkSignal()) return 'stop'
        }
      }
    }

    async function visitDirectory(dirAbsolute: string): Promise<'stop' | void> {
      let entries
      try {
        entries = await fs.readDir(dirAbsolute)
      } catch (error) {
        throw toFileVnextError(error, 'WorkspaceService.streamSearchFiles', traceId, { dirPath: dirAbsolute })
      }

      const sorted = [...entries].sort((left, right) => {
        if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1
        return left.name.localeCompare(right.name)
      })

      for (const entry of sorted) {
        if (entry.name === '.' || entry.name === '..') continue
        const fullPath = joinPosix(dirAbsolute, entry.name)
        const relPath = relativePosix(projectRoot, fullPath)

        if (entry.isDirectory) {
          if (SKIP_SEARCH_DIR_NAMES.has(entry.name)) continue
          if (isDirIgnored(relPath)) continue
          if (excludeMatcher?.(`${relPath}/`) || excludeMatcher?.(relPath)) continue

          const sub = await visitDirectory(fullPath)
          if (sub === 'stop') return 'stop'
        } else {
          const sub = await visitFile(fullPath, relPath)
          if (sub === 'stop') return 'stop'
        }
      }
    }

    await visitDirectory(projectRoot)
    if (signal?.aborted && !truncatedForCap && !stoppedForPaging) {
      await handlers.onProgress(totalFiles)
      return {
        totalFiles,
        totalMatches: totalMatchesEmitted,
        truncated: false,
      }
    }

    await handlers.onProgress(totalFiles)

    return {
      totalFiles,
      totalMatches: totalMatchesEmitted,
      truncated: truncatedForCap,
    }
  }

  async function searchFiles(
    projectPath: string,
    query: string,
    options: {
      caseSensitive?: boolean
      wholeWord?: boolean
      useRegex?: boolean
      includePatterns?: string[]
      excludePatterns?: string[]
      limit?: number
      cursor?: string
    } = {},
    traceId?: string,
  ): Promise<FileSearchResponse> {
    const projectRoot = toPosix(projectPath)
    if (pathPolicy) await pathPolicy.assertReadable(projectRoot, traceId)

    const skip = decodeSearchCursor(options.cursor)
    const limit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, options.limit ?? DEFAULT_SEARCH_LIMIT))
    const includePatterns = options.includePatterns ?? []
    const excludePatterns = options.excludePatterns ?? []

    const rgPath = await getRipgrepExecutablePath()
    if (rgPath) {
      try {
        return await collectRipgrepSearch({
          rgPath,
          projectRoot,
          query,
          options: {
            caseSensitive: options.caseSensitive ?? false,
            wholeWord: options.wholeWord ?? false,
            useRegex: options.useRegex ?? false,
            includePatterns,
            excludePatterns,
            limit,
            skip,
          },
          ctx: { pathPolicy, traceId },
          encodeCursor: encodeSearchCursor,
        })
      } catch (error) {
        if (error instanceof VnextForgeError) {
          if (error.code === ERROR_CODES.FILE_READ_ERROR) throw error
        }
        logger.warn(
          { err: error, projectRoot, query },
          'Ripgrep search failed; falling back to Node.js file walker',
        )
      }
    }

    return runNodeFilesystemSearch(
      projectRoot,
      query,
      {
        caseSensitive: options.caseSensitive,
        wholeWord: options.wholeWord,
        useRegex: options.useRegex,
        includePatterns,
        excludePatterns,
      },
      skip,
      limit,
      traceId,
    )
  }

  const STREAM_PROGRESS_STRIDE = 25

  async function streamSearchFiles(
    projectPath: string,
    query: string,
    options: {
      caseSensitive?: boolean
      wholeWord?: boolean
      useRegex?: boolean
      includePatterns?: string[]
      excludePatterns?: string[]
      limit?: number
      cursor?: string
    } = {},
    handlers: {
      onMatch: (hit: FileSearchHit) => void | Promise<void>
      onProgress: (scannedFiles: number) => void | Promise<void>
    },
    signal?: AbortSignal,
    traceId?: string,
  ): Promise<{ totalFiles: number; totalMatches: number; truncated: boolean }> {
    const projectRoot = toPosix(projectPath)
    if (pathPolicy) await pathPolicy.assertReadable(projectRoot, traceId)

    const skip = decodeSearchCursor(options.cursor)
    const limit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, options.limit ?? DEFAULT_SEARCH_LIMIT))
    const includePatterns = options.includePatterns ?? []
    const excludePatterns = options.excludePatterns ?? []

    let rgFilesBegun = 0

    const rgPath = await getRipgrepExecutablePath()
    if (rgPath) {
      const run = await runRipgrepSearchJsonStream({
        rgPath,
        projectRoot,
        query,
        options: {
          caseSensitive: options.caseSensitive ?? false,
          wholeWord: options.wholeWord ?? false,
          useRegex: options.useRegex ?? false,
          includePatterns,
          excludePatterns,
          limit,
          skip,
        },
        ctx: { pathPolicy, traceId },
        handlers: {
          onMatch: handlers.onMatch,
          onFileBegin: async () => {
            rgFilesBegun += 1
            if (rgFilesBegun % STREAM_PROGRESS_STRIDE === 0) {
              await handlers.onProgress(rgFilesBegun)
            }
          },
        },
        signal,
      })

      if (run.regexErrorMessage) {
        throw new VnextForgeError(
          ERROR_CODES.FILE_READ_ERROR,
          'Invalid regular expression in search query',
          {
            source: 'WorkspaceService.streamSearchFiles.ripgrep',
            layer: 'infrastructure',
            details: { stderrPreview: run.regexErrorMessage.slice(0, 2000) },
          },
          traceId,
        )
      }

      await handlers.onProgress(run.totalFiles)
      return {
        totalFiles: run.totalFiles,
        totalMatches: run.totalMatches,
        truncated: run.truncated,
      }
    }

    return streamNodeFilesystemSearch(
      projectRoot,
      query,
      {
        caseSensitive: options.caseSensitive,
        wholeWord: options.wholeWord,
        useRegex: options.useRegex,
        includePatterns,
        excludePatterns,
      },
      {
        onMatch: handlers.onMatch,
        onProgress: handlers.onProgress,
      },
      signal,
      skip,
      limit,
      STREAM_PROGRESS_STRIDE,
      traceId,
    )
  }

  async function browseDirs(
    dirPath: string | undefined,
    traceId?: string,
  ): Promise<{ resolvedPath: string; entries: DirectoryEntry[] }> {
    // Explicit "system root" request: list Windows drives, or treat POSIX root.
    if (dirPath === SYSTEM_ROOT_TOKEN) {
      if (fs.isWindows) {
        return { resolvedPath: '', entries: await listWindowsDrives(traceId) }
      }
      return { resolvedPath: '/', entries: await readDirEntries('/', traceId) }
    }

    // Default (no path supplied): start from the user's home directory so the
    // folder picker opens at `~/` instead of an empty/system view.
    const rawTarget = dirPath && dirPath.length > 0 ? dirPath : fs.resolveHome()
    // Normalize separators to the host OS convention. Inputs may arrive with
    // mixed `\\` / `/` (breadcrumb clicks vs. listed entries vs. user paste);
    // we hand the OS-native form to both the path policy and `readDir`, and
    // also return it to the client so future calls stay consistent.
    const target = toNativePath(rawTarget)
    if (pathPolicy) await pathPolicy.assertBrowsable(target, traceId)
    return { resolvedPath: target, entries: await readDirEntries(target, traceId) }
  }

  /**
   * OS-aware join used only for the folder picker — see `joinWithSeparator`
   * docs in `internal/paths.ts`. We keep `joinPosix` for any persisted path
   * (project IDs, link files) so they remain platform-portable.
   */
  function nativeJoin(...parts: string[]): string {
    return joinWithSeparator(fs.isWindows ? '\\' : '/', ...parts)
  }

  /** Convert any mixed-separator path string to the host OS convention. */
  function toNativePath(filePath: string): string {
    if (!fs.isWindows) return filePath.replace(/\\/g, '/')
    return filePath.replace(/\//g, '\\').replace(/\\{2,}/g, '\\')
  }

  async function readDirEntries(target: string, traceId?: string): Promise<DirectoryEntry[]> {
    try {
      const entries = await fs.readDir(target)
      return entries
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => ({
          name: entry.name,
          path: nativeJoin(target, entry.name),
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
    const trimmedDescription = description?.trim()
    const desc =
      trimmedDescription && trimmedDescription.length > 0
        ? trimmedDescription
        : `${normalizedDomain} domain configuration`
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
    streamSearchFiles,
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
