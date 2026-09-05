import * as path from 'node:path'
import * as vscode from 'vscode'
import type { ProjectService, VnextWorkspaceConfig } from '@vnext-forge-studio/services-core'
import { baseLogger } from './shared/logger.js'
import type { FileRoute, FileRouteKind } from './file-router.js'
import type { ResolvedSolution, VnextWorkspaceDetector } from './workspace-detector.js'
import type { DesignerEditorKind, DesignerOpenEditorMessage } from './panels/DesignerPanel.js'

/**
 * `resolveFileRoute` sonucu, webview içindeki yapılandırılmış bileşen editörlerine
 * karşılık geliyor mu (task / schema / workflow / …).
 */
export function isDesignerEditorRoute(
  route: FileRoute,
): route is FileRoute & { kind: DesignerEditorKind } {
  const kind: FileRouteKind = route.kind
  return (
    kind === 'workflow' ||
    kind === 'task' ||
    kind === 'schema' ||
    kind === 'view' ||
    kind === 'function' ||
    kind === 'extension' ||
    kind === 'mapping' ||
    kind === 'config'
  )
}

export interface ResolvedProjectForFile extends ResolvedSolution {
  /** `config.domain` — the project id every `projects/*` RPC is keyed by. */
  projectId: string
  config: VnextWorkspaceConfig
  configFileName: string
}

/** Files already warned about falling back to the default solution (one toast per file per session). */
const unknownDomainWarned = new Set<string>()

/**
 * Resolve the solution (and thereby the project) a file belongs to, link it in
 * the project registry, and surface a user-facing warning when nothing usable
 * is found. Returns `null` after warning.
 */
export async function resolveProjectForFile(
  fsPath: string,
  deps: { detector: VnextWorkspaceDetector; projectService: ProjectService },
  opts?: { componentDomain?: string; text?: string },
): Promise<ResolvedProjectForFile | null> {
  const root = deps.detector.findOwningRoot(fsPath)
  if (!root) {
    void vscode.window.showWarningMessage(
      'vnext-forge-studio: The selected file is not inside a vnext workspace (no vnext.config.json found).',
    )
    return null
  }

  let resolved: ResolvedSolution | undefined
  try {
    resolved = await deps.detector.resolveSolutionForFile(fsPath, opts)
  } catch (error) {
    baseLogger.error({ error: (error as Error).message, fsPath }, 'Failed to resolve solution for file')
    void vscode.window.showErrorMessage('vnext-forge-studio: Failed to read workspace configuration.')
    return null
  }

  if (!resolved?.solution.config) {
    const invalid = root.solutions.find((s) => s.status.status === 'invalid')
    if (invalid?.status.status === 'invalid') {
      void vscode.window.showWarningMessage(
        `vnext-forge-studio: ${invalid.fileName} is invalid. ${invalid.status.message}`,
      )
    } else {
      void vscode.window.showWarningMessage(
        `vnext-forge-studio: No valid solution file (vnext.config.json) found in ${path.basename(root.folderPath)}.`,
      )
    }
    return null
  }

  const { solution } = resolved
  const config = solution.config!
  try {
    await deps.projectService.importProject(root.folderPath, undefined, {
      configFileName: solution.fileName,
    })
  } catch (error) {
    baseLogger.warn(
      { folder: root.folderPath, file: solution.fileName, error: (error as Error).message },
      'Failed to link project registry entry — API calls keyed by projectId may fail',
    )
  }

  for (const issue of resolved.issues) {
    if (issue.code !== 'component.unknownDomain') continue
    const key = fsPath.replace(/\\/g, '/')
    if (unknownDomainWarned.has(key)) continue
    unknownDomainWarned.add(key)
    void vscode.window.showWarningMessage(`vnext-forge-studio: ${issue.message}`)
  }

  return {
    ...resolved,
    projectId: config.domain,
    config,
    configFileName: solution.fileName,
  }
}

/** Compose the `open-editor` frame for a resolved project + designer route. */
export function buildOpenEditorMessage(
  resolved: ResolvedProjectForFile,
  route: { kind: DesignerEditorKind; group: string; name: string; filePath: string },
): DesignerOpenEditorMessage {
  return {
    type: 'open-editor',
    kind: route.kind,
    projectId: resolved.projectId,
    projectPath: resolved.root.folderPath,
    projectDomain: resolved.config.domain,
    group: route.group,
    name: route.name,
    filePath: route.filePath,
    vnextConfig: resolved.config,
    configFileName: resolved.configFileName,
  }
}
