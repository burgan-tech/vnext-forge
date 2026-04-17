import * as path from 'node:path'
import type { VnextWorkspaceConfig } from '@vnext-forge/services-core'

/**
 * Editor "kinds" the webview can render.
 *
 * - `'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension'`:
 *   render the matching designer editor inside the shared webview panel.
 * - `'config' | 'unknown'`: the host should let VS Code's native editor open
 *   the file. The webview is only used for component editors; generic code
 *   editing is delegated to VS Code itself (see `commands.ts`).
 */
export type FileRouteKind =
  | 'workflow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension'
  | 'config'
  | 'unknown'

/**
 * Result of resolving a workspace file path against a project's
 * `vnext.config.json`. Replaces the previous SPA-style `navigateTo` URL
 * model — the webview no longer carries a router, so the host passes
 * `kind + group + name` directly.
 */
export interface FileRoute {
  kind: FileRouteKind
  group: string
  name: string
  /** Absolute file path for downstream consumers (logging, native open). */
  filePath: string
}

function normalize(p?: string | null): string {
  if (!p) return ''
  return p.replace(/\\/g, '/')
}

function normalizeConfigPath(p?: string | null): string {
  return normalize(p).replace(/^\/+|\/+$/g, '')
}

function stripPrefix(target: string, prefix: string): string | null {
  const t = normalizeConfigPath(target)
  const pr = normalizeConfigPath(prefix)
  if (!pr) return t
  if (t.toLowerCase() === pr.toLowerCase()) return ''
  if (t.toLowerCase().startsWith(`${pr.toLowerCase()}/`)) return t.slice(pr.length + 1)
  return null
}

function sliceAfterSegment(rel: string, segment: string): string | null {
  const r = normalizeConfigPath(rel)
  const s = normalizeConfigPath(segment)
  if (!s) return null
  const rl = r.toLowerCase()
  const sl = s.toLowerCase()
  if (rl === sl) return ''
  if (rl.startsWith(`${sl}/`)) return r.slice(s.length + 1)
  return null
}

function sliceAfterEmbedded(full: string, segment: string): string | null {
  const f = normalizeConfigPath(full)
  const s = normalizeConfigPath(segment)
  if (!s) return null
  const fl = f.toLowerCase()
  const sl = s.toLowerCase()
  if (fl === sl) return ''
  if (fl.startsWith(`${sl}/`)) return f.slice(s.length + 1)
  const needle = `/${sl}/`
  const idx = fl.indexOf(needle)
  if (idx === -1) return null
  return f.slice(idx + needle.length)
}

function extractRest(relativePath: string, componentsRoot: string, segment: string): string | null {
  const s = normalizeConfigPath(segment)
  if (!s) return null
  const rel = normalizeConfigPath(relativePath)
  const afterRoot = stripPrefix(rel, componentsRoot) ?? rel
  const direct = sliceAfterSegment(afterRoot, s)
  if (direct !== null) return direct
  return sliceAfterEmbedded(rel, s)
}

function parseGroupName(rest: string, ext = '.json'): { group: string; name: string } | null {
  const parts = rest.split('/')
  if (parts.length < 2) return null
  const fileName = parts[parts.length - 1]
  if (!fileName.toLowerCase().endsWith(ext.toLowerCase())) return null
  const name = fileName.slice(0, fileName.length - ext.length)
  const group = parts.slice(0, -1).join('/')
  return { group, name }
}

/**
 * Resolve which designer editor (if any) should handle a file inside a vnext
 * project. The host uses this to decide whether to open the shared webview
 * (for component editors) or fall back to VS Code's native text editor (for
 * `vnext.config.json` and unknown file types).
 */
export function resolveFileRoute(
  filePathAbsolute: string,
  config: VnextWorkspaceConfig | null,
  projectPath: string,
): FileRoute {
  const normalizedFile = normalize(filePathAbsolute)
  const normalizedProject = normalize(projectPath)
  const absRel = path
    .relative(path.resolve(normalizedProject), path.resolve(normalizedFile))
    .split(path.sep)
    .join('/')
  const relativePath = absRel && !absRel.startsWith('..') ? absRel : normalizedFile

  if (relativePath.toLowerCase() === 'vnext.config.json') {
    return {
      kind: 'config',
      group: '',
      name: 'vnext.config.json',
      filePath: normalizedFile,
    }
  }

  const unknownFallback = (): FileRoute => ({
    kind: 'unknown',
    group: '',
    name: path.basename(normalizedFile),
    filePath: normalizedFile,
  })

  if (!config) return unknownFallback()

  const componentsRoot = normalizeConfigPath(config.paths?.componentsRoot)
  if (!componentsRoot) return unknownFallback()

  const checks: { kind: FileRouteKind; segment: string }[] = [
    { kind: 'workflow', segment: normalizeConfigPath(config.paths.workflows) },
    { kind: 'task', segment: normalizeConfigPath(config.paths.tasks) },
    { kind: 'schema', segment: normalizeConfigPath(config.paths.schemas) },
    { kind: 'view', segment: normalizeConfigPath(config.paths.views) },
    { kind: 'function', segment: normalizeConfigPath(config.paths.functions) },
    { kind: 'extension', segment: normalizeConfigPath(config.paths.extensions) },
  ]

  for (const { kind, segment } of checks) {
    if (!segment) continue
    const rest = extractRest(relativePath, componentsRoot, segment)
    if (rest === null) continue
    if (kind === 'workflow' && (rest.startsWith('.meta/') || rest.includes('/.meta/'))) {
      continue
    }
    const parsed = parseGroupName(rest, '.json')
    if (!parsed) continue
    return {
      kind,
      group: parsed.group,
      name: parsed.name,
      filePath: normalizedFile,
    }
  }

  return unknownFallback()
}
