import * as path from 'node:path'
import * as vscode from 'vscode'
import type { ProjectService, WorkspaceService, VnextWorkspaceConfig } from '@vnext-forge-studio/services-core'
import { baseLogger } from './shared/logger.js'
import type { FileRoute, FileRouteKind } from './file-router.js'
import type { VnextWorkspaceRoot } from './workspace-detector.js'
import type { DesignerEditorKind } from './panels/DesignerPanel.js'

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
    kind === 'config'
  )
}

export async function resolveProjectForRoot(
  root: VnextWorkspaceRoot,
  workspaceService: WorkspaceService,
  projectService: ProjectService,
): Promise<{ projectId: string; config: VnextWorkspaceConfig } | null> {
  try {
    const status = await workspaceService.readConfigStatus(root.folderPath)
    if (status.status === 'ok') {
      try {
        await projectService.importProject(root.folderPath)
      } catch (error) {
        baseLogger.warn(
          { folder: root.folderPath, error: (error as Error).message },
          'Failed to link project registry entry — API calls keyed by projectId may fail',
        )
      }
      return { projectId: status.config.domain, config: status.config }
    }
    if (status.status === 'invalid') {
      void vscode.window.showWarningMessage(
        `vnext-forge-studio: ${path.basename(root.folderPath)}/vnext.config.json is invalid. ${status.message}`,
      )
      return null
    }
    void vscode.window.showWarningMessage(
      `vnext-forge-studio: vnext.config.json is missing in ${root.folderPath}.`,
    )
    return null
  } catch (error) {
    baseLogger.error({ error: (error as Error).message }, 'Failed to read vnext.config.json')
    void vscode.window.showErrorMessage('vnext-forge-studio: Failed to read workspace configuration.')
    return null
  }
}
