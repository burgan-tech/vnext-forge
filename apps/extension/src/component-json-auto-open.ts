import * as vscode from 'vscode'
import type { ProjectService, WorkspaceService } from '@vnext-forge/services-core'
import { resolveFileRoute } from './file-router.js'
import { isDesignerEditorRoute, resolveProjectForRoot } from './designer-helpers.js'
import type { DesignerPanel } from './panels/DesignerPanel.js'
import type { VnextWorkspaceDetector } from './workspace-detector.js'
import { baseLogger } from './shared/logger.js'

/** vnext.config paths altındaki bileşen JSON'u, “metin editörü ile aç” için kısa süre otomatik tasarımcıyı atla. */
const skipDesignerAutoOpenUntil = new Map<string, number>()

const SKIP_TTL_MS = 5_000

/**
 * Aynı dosya URI'si için bir süre otomatik tasarımcı açılmaz (`Open in Text Editor` vb.).
 */
export function markUriSkipComponentDesignerAutoOpen(uri: vscode.Uri, ttlMs: number = SKIP_TTL_MS): void {
  skipDesignerAutoOpenUntil.set(uri.toString(), Date.now() + ttlMs)
}

function shouldSkipForUri(uri: vscode.Uri): boolean {
  const key = uri.toString()
  const until = skipDesignerAutoOpenUntil.get(key)
  if (until === undefined) return false
  if (Date.now() > until) {
    skipDesignerAutoOpenUntil.delete(key)
    return false
  }
  skipDesignerAutoOpenUntil.delete(key)
  return true
}

function isUriInAnyDiffTab(uri: vscode.Uri): boolean {
  const us = uri.toString()
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputTextDiff) {
        if (
          tab.input.original.toString() === us ||
          tab.input.modified.toString() === us
        ) {
          return true
        }
      }
    }
  }
  return false
}

function findPlainTextTabForUri(uri: vscode.Uri): vscode.Tab | undefined {
  const us = uri.toString()
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === us) {
        return tab
      }
    }
  }
  return undefined
}

/** `vnext.config` paths altındaki bileşen .json: Explorer tıklanınca tasarımcı, metin sekmesini kapat. */
export function registerComponentJsonAutoOpen(
  context: vscode.ExtensionContext,
  deps: {
    detector: VnextWorkspaceDetector
    designerPanel: DesignerPanel
    workspaceService: WorkspaceService
    projectService: ProjectService
  },
): void {
  const { detector, designerPanel, workspaceService, projectService } = deps

  const onOpen = (document: vscode.TextDocument) => {
    void (async () => {
      if (document.uri.scheme !== 'file') return
      if (!document.fileName.toLowerCase().endsWith('.json')) return
      if (shouldSkipForUri(document.uri)) return
      if (isUriInAnyDiffTab(document.uri)) return

      const cfg = vscode.workspace.getConfiguration('vnextForge')
      if (cfg.get<boolean>('openComponentJsonInDesigner', true) !== true) return

      const target = document.uri.fsPath
      const root = detector.findOwningRoot(target)
      if (!root) return

      const project = await resolveProjectForRoot(root, workspaceService, projectService)
      if (!project) return

      const route = resolveFileRoute(target, project.config, root.folderPath)
      if (!isDesignerEditorRoute(route)) return

      designerPanel.openEditor({
        type: 'open-editor',
        kind: route.kind,
        projectId: project.projectId,
        projectPath: root.folderPath,
        projectDomain: project.config.domain,
        group: route.group,
        name: route.name,
        filePath: route.filePath,
        vnextConfig: project.config,
      })

      const tab = findPlainTextTabForUri(document.uri)
      if (tab) {
        try {
          await vscode.window.tabGroups.close(tab)
        } catch (error) {
          baseLogger.warn(
            { error: (error as Error).message, path: target },
            'Could not close text tab after opening designer',
          )
        }
      }
    })()
  }

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(onOpen))
}
