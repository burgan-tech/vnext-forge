import type * as vscode from 'vscode'
import { WebviewPanelManager } from './webview/WebviewPanelManager'
import { MessageRouter } from './MessageRouter'
import { ProjectService } from '@handlers/project/service'
import { WorkspaceService } from '@handlers/workspace/service'
import { VnextWorkspaceDetector } from './workspace-detector'
import { registerCommands } from './commands'
import { bootstrapLsp } from './lsp-bootstrap'
import { baseLogger } from '@ext/shared/logger'

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  baseLogger.info({}, 'vnext-forge activating')

  const workspaceService = new WorkspaceService()
  const projectService = new ProjectService(workspaceService)

  const router = new MessageRouter()
  const panelManager = new WebviewPanelManager(context, router)

  const detector = new VnextWorkspaceDetector(workspaceService)
  context.subscriptions.push(detector)

  registerCommands(context, {
    projectService,
    workspaceService,
    detector,
    panelManager,
  })

  context.subscriptions.push(
    detector.onDidChange((roots) => {
      void importDetectedRoots(roots, projectService)
    }),
  )

  await detector.refresh()

  if (detector.getRoots().length > 0) {
    bootstrapLsp()
  }
}

async function importDetectedRoots(
  roots: readonly { folderPath: string }[],
  projectService: ProjectService,
): Promise<void> {
  for (const root of roots) {
    try {
      await projectService.importProject(root.folderPath)
    } catch (error) {
      baseLogger.warn(
        { folder: root.folderPath, error: (error as Error).message },
        'Failed to link vnext workspace into project registry',
      )
    }
  }
}

export function deactivate(): void {
  // No-op: all disposables are registered on context.subscriptions.
}
