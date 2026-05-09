import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { once } from 'node:events'
import { createInterface } from 'node:readline'

import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

import type { PathPolicy } from '../../internal/path-policy.js'
import { basename, isAbsolutePosix, joinPosix, toPosix } from '../../internal/paths.js'
import type { FileSearchHit, FileSearchResponse } from './types.js'

/** Keep in sync with `workspace.service.ts` search limits. */
const MAX_SCAN_MATCHES = 50_000

const RG_SKIP_GLOBS = ['!**/node_modules/**', '!.git/**', '!**/.svn/**', '!**/.hg/**'] as const

export async function getRipgrepExecutablePath(): Promise<string | null> {
  try {
    const mod = await import('@vscode/ripgrep')
    const p = mod.rgPath
    return typeof p === 'string' && p.length > 0 && existsSync(p) ? p : null
  } catch {
    return null
  }
}

function resolveHitPath(projectRoot: string, pathText: string): string {
  const root = toPosix(projectRoot)
  const normalized = pathText.replace(/\\/g, '/').replace(/^\.\//u, '')
  if (isAbsolutePosix(normalized)) {
    return normalized
  }
  return joinPosix(root, normalized)
}

function buildLineText(raw: string): string {
  return raw.replace(/\r?\n$/u, '')
}

function byteOffsetToColumn(lineUtf8: string, byteStart: number): number {
  const buf = Buffer.from(lineUtf8, 'utf8')
  const safeStart = Math.min(Math.max(0, byteStart), buf.length)
  return buf.subarray(0, safeStart).toString('utf8').length + 1
}

function matchLengthChars(lineUtf8: string, byteStart: number, byteEnd: number): number {
  const buf = Buffer.from(lineUtf8, 'utf8')
  const s = Math.min(Math.max(0, byteStart), buf.length)
  const e = Math.min(Math.max(s, byteEnd), buf.length)
  return buf.subarray(s, e).toString('utf8').length
}

function isBinaryExtensionFileName(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return false
  const ext = fileName.slice(dot + 1).toLowerCase()
  if (ext === '') return false
  const binary = new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'ico',
    'bmp',
    'pdf',
    'zip',
    'wasm',
    'exe',
    'dll',
    'so',
    'dylib',
    'woff',
    'woff2',
    'ttf',
    'mp3',
    'mp4',
    'class',
    'jar',
    'sqlite',
    'db',
  ])
  return binary.has(ext)
}

export interface RipgrepSearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  useRegex: boolean
  includePatterns: string[]
  excludePatterns: string[]
  limit: number
  skip: number
}

export interface RipgrepSearchContext {
  pathPolicy: PathPolicy | undefined
  traceId: string | undefined
}

function buildRipgrepArgs(query: string, options: RipgrepSearchOptions): string[] {
  const args: string[] = ['--json', '--no-messages', '--hidden', '--max-filesize', '4M']

  for (const g of RG_SKIP_GLOBS) {
    args.push('--glob', g)
  }

  for (const inc of options.includePatterns) {
    if (inc.trim()) args.push('--glob', inc.trim())
  }

  for (const exc of options.excludePatterns) {
    const t = exc.trim()
    if (t) args.push('--glob', `!${t}`)
  }

  if (options.caseSensitive) {
    args.push('--case-sensitive')
  } else {
    args.push('--ignore-case')
  }

  if (options.wholeWord) {
    args.push('--word-regexp')
  }

  if (!options.useRegex) {
    args.push('--fixed-strings')
  }

  args.push('-e', query)
  args.push('.')

  return args
}

export interface RipgrepStreamHandlers {
  onMatch: (hit: FileSearchHit) => void | Promise<void>
  /**
   * Called when ripgrep begins searching a file (`begin` JSON message).
   */
  onFileBegin?: () => void | Promise<void>
}

export interface RipgrepRunResult {
  totalFiles: number
  totalMatches: number
  truncated: boolean
  regexErrorMessage?: string
}

/**
 * Run ripgrep with `--json`, invoking handlers for each match.
 * Honors `limit` / `skip` pagination and `MAX_SCAN_MATCHES` like the Node walker.
 */
export async function runRipgrepSearchJsonStream(params: {
  rgPath: string
  projectRoot: string
  query: string
  options: RipgrepSearchOptions
  ctx: RipgrepSearchContext
  handlers: RipgrepStreamHandlers
  signal?: AbortSignal
}): Promise<RipgrepRunResult> {
  const { rgPath, projectRoot, query, options, ctx, handlers, signal } = params

  const args = buildRipgrepArgs(query, options)
  const child = spawn(rgPath, args, {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let intentionalKill = false
  const onAbort = () => {
    intentionalKill = true
    child.kill('SIGTERM')
  }
  if (signal) {
    if (signal.aborted) {
      onAbort()
    } else {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  const stderrChunks: string[] = []
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrChunks.push(chunk.toString('utf8'))
  })

  let globalMatchIndex = 0
  let truncated = false
  let stoppedForPaging = false
  let beginFileCount = 0
  let summaryFileCount: number | undefined
  let totalMatchesEmitted = 0

  const exitPromise = once(child, 'close') as Promise<[number | null, NodeJS.Signals | null]>

  const rl = createInterface({ input: child.stdout!, crlfDelay: Infinity })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue
      let msg: { type?: string; data?: unknown }
      try {
        msg = JSON.parse(line) as { type?: string; data?: unknown }
      } catch {
        continue
      }

      if (msg.type === 'summary') {
        const data = msg.data as { stats?: { searches?: number } } | undefined
        const searches = data?.stats?.searches
        if (typeof searches === 'number' && Number.isFinite(searches)) {
          summaryFileCount = searches
        }
        continue
      }

      if (msg.type === 'begin') {
        const data = msg.data as { path?: { text?: string } } | undefined
        const rel = data?.path?.text
        if (typeof rel === 'string' && rel.length > 0) {
          const base = basename(rel.replace(/\\/gu, '/'))
          if (isBinaryExtensionFileName(base)) {
            continue
          }
        }
        beginFileCount += 1
        await handlers.onFileBegin?.()
      }

      if (msg.type !== 'match') continue

      const data = msg.data as {
        path?: { text?: string }
        lines?: { text?: string }
        line_number?: number
        submatches?: { start: number; end: number }[]
      }

      const pathText = data.path?.text
      const lineNumber = data.line_number
      const rawLine = data.lines?.text
      const submatches = data.submatches

      if (
        typeof pathText !== 'string' ||
        typeof lineNumber !== 'number' ||
        typeof rawLine !== 'string' ||
        !Array.isArray(submatches)
      ) {
        continue
      }

      const fullPath = resolveHitPath(projectRoot, pathText)
      if (isBinaryExtensionFileName(basename(fullPath))) {
        continue
      }

      if (ctx.pathPolicy) {
        try {
          await ctx.pathPolicy.assertReadable(fullPath, ctx.traceId)
        } catch {
          continue
        }
      }

      const lineText = buildLineText(rawLine)

      for (const sm of submatches) {
        if (typeof sm.start !== 'number' || typeof sm.end !== 'number') continue

        globalMatchIndex += 1
        if (globalMatchIndex > MAX_SCAN_MATCHES) {
          truncated = true
          intentionalKill = true
          child.kill('SIGTERM')
          break
        }

        if (globalMatchIndex <= options.skip) {
          continue
        }

        if (totalMatchesEmitted >= options.limit) {
          stoppedForPaging = true
          intentionalKill = true
          child.kill('SIGTERM')
          break
        }

        const column = byteOffsetToColumn(lineText, sm.start)
        const matchLength = matchLengthChars(lineText, sm.start, sm.end)

        const hit: FileSearchHit = {
          path: fullPath,
          line: lineNumber,
          column,
          text: lineText,
          matchLength,
        }
        totalMatchesEmitted += 1
        await handlers.onMatch(hit)
      }

      if (truncated || stoppedForPaging) {
        break
      }
    }
  } finally {
    rl.close()
  }

  const [exitCode] = await exitPromise

  if (signal?.aborted) {
    const totalFiles = summaryFileCount ?? beginFileCount
    return { totalFiles, totalMatches: totalMatchesEmitted, truncated }
  }

  if (!intentionalKill && exitCode === 2) {
    const errText = stderrChunks.join('').trim()
    return {
      totalFiles: summaryFileCount ?? beginFileCount,
      totalMatches: totalMatchesEmitted,
      truncated,
      regexErrorMessage: errText || 'ripgrep exited with an error',
    }
  }

  const totalFiles = summaryFileCount ?? beginFileCount

  return { totalFiles, totalMatches: totalMatchesEmitted, truncated }
}

export async function collectRipgrepSearch(params: {
  rgPath: string
  projectRoot: string
  query: string
  options: RipgrepSearchOptions
  ctx: RipgrepSearchContext
  encodeCursor: (nextSkip: number) => string
}): Promise<FileSearchResponse> {
  const collected: FileSearchHit[] = []
  const run = await runRipgrepSearchJsonStream({
    rgPath: params.rgPath,
    projectRoot: params.projectRoot,
    query: params.query,
    options: params.options,
    ctx: params.ctx,
    handlers: {
      onMatch: (hit) => {
        collected.push(hit)
      },
    },
  })

  if (run.regexErrorMessage) {
    throw new VnextForgeError(
      ERROR_CODES.FILE_READ_ERROR,
      'Invalid regular expression in search query',
      {
        source: 'WorkspaceService.searchFiles.ripgrep',
        layer: 'infrastructure',
        details: { stderrPreview: run.regexErrorMessage.slice(0, 2000) },
      },
      params.ctx.traceId,
    )
  }

  const skip = params.options.skip
  const limit = params.options.limit
  const stoppedForPaging = collected.length === limit && !run.truncated
  const nextCursor =
    stoppedForPaging && collected.length === limit ? params.encodeCursor(skip + limit) : undefined

  return {
    items: collected,
    totalFiles: run.totalFiles,
    truncated: run.truncated,
    nextCursor,
  }
}
