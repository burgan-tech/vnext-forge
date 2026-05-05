import type { VnextWorkspaceConfig } from '../workspace/types.js'
import { basename, joinPosix, relativePosix, toPosix } from '../../internal/paths.js'

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
  filePath: string
  navigateTo?: string
  editorTab?: { filePath: string; language: string; title: string }
}

function normalizeConfigPath(p?: string | null): string {
  return toPosix(p ?? '').replace(/^\/+|\/+$/g, '')
}

function stripPrefix(target: string, prefix: string): string | null {
  const t = normalizeConfigPath(target)
  const pr = normalizeConfigPath(prefix)
  if (!pr) return t
  if (t.toLowerCase() === pr.toLowerCase()) return ''
  if (t.toLowerCase().startsWith(`${pr.toLowerCase()}/`)) return t.slice(pr.length + 1)
  return null
}

function sliceAfterConfigSegment(componentRelative: string, segment: string): string | null {
  const rel = normalizeConfigPath(componentRelative)
  const seg = normalizeConfigPath(segment)
  if (!seg) return null
  const relL = rel.toLowerCase()
  const segL = seg.toLowerCase()
  if (relL === segL) return ''
  if (!relL.startsWith(`${segL}/`)) return null
  return rel.slice(seg.length + 1)
}

function sliceAfterEmbeddedSegment(fullPath: string, segment: string): string | null {
  const f = normalizeConfigPath(fullPath)
  const seg = normalizeConfigPath(segment)
  if (!seg) return null
  const fL = f.toLowerCase()
  const segL = seg.toLowerCase()
  if (fL === segL) return ''
  if (fL.startsWith(`${segL}/`)) return f.slice(seg.length + 1)
  const needle = `/${segL}/`
  const idx = fL.indexOf(needle)
  if (idx === -1) return null
  return f.slice(idx + needle.length)
}

function extractRest(relativePath: string, componentsRoot: string, segment: string): string | null {
  const seg = normalizeConfigPath(segment)
  if (!seg) return null
  const rel = normalizeConfigPath(relativePath)
  const afterRoot = stripPrefix(rel, componentsRoot) ?? rel
  const direct = sliceAfterConfigSegment(afterRoot, seg)
  if (direct !== null) return direct
  return sliceAfterEmbeddedSegment(rel, seg)
}

function parseGroupName(rest: string, ext = '.json'): { group: string; name: string } | null {
  const parts = rest.split('/')
  if (parts.length === 0) return null
  const fileName = parts[parts.length - 1]
  if (!fileName.toLowerCase().endsWith(ext.toLowerCase())) return null
  const name = fileName.slice(0, fileName.length - ext.length)
  if (!name) return null
  const group = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
  return { group, name }
}

function detectLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'json':
      return 'json'
    case 'csx':
    case 'cs':
      return 'csharp'
    case 'js':
      return 'javascript'
    case 'ts':
      return 'typescript'
    case 'xml':
      return 'xml'
    case 'yaml':
    case 'yml':
      return 'yaml'
    case 'md':
      return 'markdown'
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'http':
      return 'http'
    case 'sql':
      return 'sql'
    case 'sh':
    case 'bash':
      return 'shell'
    case 'py':
      return 'python'
    case 'go':
      return 'go'
    case 'rs':
      return 'rust'
    default:
      return 'plaintext'
  }
}

/**
 * Pure file-route resolver. Both shells share this:
 * - Web: maps a file selected in the in-app FileTree to a designer route.
 * - Extension host: maps a `vscode.Uri` opened in VS Code Explorer to the
 *   route the webview should navigate to.
 */
export function resolveFileRoute(
  filePathAbsolute: string,
  config: VnextWorkspaceConfig | null,
  projectId: string,
  projectPath: string,
): FileRoute {
  const normalizedFile = toPosix(filePathAbsolute)
  const relAbs = relativePosix(toPosix(projectPath), normalizedFile)
  const relativePath = relAbs && !relAbs.startsWith('..') ? relAbs : normalizedFile

  if (relativePath.toLowerCase() === 'vnext.config.json') {
    return {
      type: 'config',
      group: '',
      name: 'vnext.config.json',
      filePath: normalizedFile,
      navigateTo: `/project/${projectId}/code/${encodeURIComponent(normalizedFile)}`,
      editorTab: { filePath: normalizedFile, language: 'json', title: 'vnext.config.json' },
    }
  }

  const fileName = basename(normalizedFile)

  const unknownFallback = (): FileRoute => ({
    type: 'unknown',
    group: '',
    name: fileName,
    filePath: normalizedFile,
    navigateTo: `/project/${projectId}/code/${encodeURIComponent(normalizedFile)}`,
    editorTab: { filePath: normalizedFile, language: detectLanguage(fileName), title: fileName },
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
    if (kind === 'workflow' && (rest.startsWith('.meta/') || rest.includes('/.meta/'))) continue
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

void joinPosix // keep import used for tooling
