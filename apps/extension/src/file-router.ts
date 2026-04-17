import * as path from 'node:path'
import type { VnextWorkspaceConfig } from '@vnext-forge/vnext-types'

export type FileRouteType =
  | 'workflow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension'
  | 'config'
  | 'unknown'

export interface FileRoute {
  type: FileRouteType
  group: string
  name: string
  navigateTo?: string
  /** Absolute file path, useful for editor tabs fallback. */
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
 * Resolve the navigation route for a file inside a vnext project.
 * Mirrors the logic in apps/web/src/modules/project-workspace/FileRouter.ts so
 * the extension host can decide where to point the webview.
 */
export function resolveFileRoute(
  filePathAbsolute: string,
  config: VnextWorkspaceConfig | null,
  projectId: string,
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
      type: 'config',
      group: '',
      name: 'vnext.config.json',
      filePath: normalizedFile,
      navigateTo: `/project/${projectId}/code/${encodeURIComponent(normalizedFile)}`,
    }
  }

  const unknownFallback = (): FileRoute => ({
    type: 'unknown',
    group: '',
    name: path.basename(normalizedFile),
    filePath: normalizedFile,
    navigateTo: `/project/${projectId}/code/${encodeURIComponent(normalizedFile)}`,
  })

  if (!config) return unknownFallback()

  const componentsRoot = normalizeConfigPath(config.paths?.componentsRoot)
  if (!componentsRoot) return unknownFallback()

  const checks: { kind: FileRouteType; segment: string; route: string }[] = [
    { kind: 'workflow', segment: normalizeConfigPath(config.paths.workflows), route: 'flow' },
    { kind: 'task', segment: normalizeConfigPath(config.paths.tasks), route: 'task' },
    { kind: 'schema', segment: normalizeConfigPath(config.paths.schemas), route: 'schema' },
    { kind: 'view', segment: normalizeConfigPath(config.paths.views), route: 'view' },
    { kind: 'function', segment: normalizeConfigPath(config.paths.functions), route: 'function' },
    { kind: 'extension', segment: normalizeConfigPath(config.paths.extensions), route: 'extension' },
  ]

  for (const { kind, segment, route } of checks) {
    if (!segment) continue
    const rest = extractRest(relativePath, componentsRoot, segment)
    if (rest === null) continue
    if (kind === 'workflow' && (rest.startsWith('.meta/') || rest.includes('/.meta/'))) {
      continue
    }
    const parsed = parseGroupName(rest, '.json')
    if (!parsed) continue
    return {
      type: kind,
      group: parsed.group,
      name: parsed.name,
      filePath: normalizedFile,
      navigateTo: `/project/${projectId}/${route}/${encodeURIComponent(parsed.group)}/${encodeURIComponent(parsed.name)}`,
    }
  }

  return unknownFallback()
}
