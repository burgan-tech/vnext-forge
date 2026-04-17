import * as vscode from 'vscode';

import { registerCommands } from './commands.js';
import { composeExtensionLspBridge } from './composition/lsp.js';
import { composeExtensionServices } from './composition/services.js';
import { bootstrapLsp } from './lsp-bootstrap.js';
import { MessageRouter } from './MessageRouter.js';
import { createVsCodeOutputChannelLogger } from './adapters/vscode-output-channel-logger.js';
import { baseLogger } from './shared/logger.js';
import { WebviewPanelManager } from './webview/WebviewPanelManager.js';
import { VnextWorkspaceDetector } from './workspace-detector.js';

/**
 * vnext-forge extension entry point. Composes the shared `services-core` +
 * `lsp-core` packages with VS Code-specific adapters (workspace root
 * resolver, OutputChannel logger, webview `postMessage` transport) and wires
 * the resulting services to commands and the webview `MessageRouter`.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  baseLogger.info({}, 'vnext-forge activating');

  const outputChannel = vscode.window.createOutputChannel('vnext-forge-core');
  context.subscriptions.push(outputChannel);
  const loggerAdapter = createVsCodeOutputChannelLogger(outputChannel);

  const { services, registry } = composeExtensionServices(loggerAdapter);
  const lspBridge = composeExtensionLspBridge(loggerAdapter);

  const router = new MessageRouter({
    registry,
    services,
    lspBridge,
    logger: loggerAdapter,
  });
  const panelManager = new WebviewPanelManager(context, router);

  const detector = new VnextWorkspaceDetector(services.workspaceService);
  context.subscriptions.push(detector);

  registerCommands(context, {
    projectService: services.projectService,
    workspaceService: services.workspaceService,
    detector,
    panelManager,
  });

  context.subscriptions.push(
    detector.onDidChange((roots) => {
      void importDetectedRoots(roots, services.projectService);
    }),
  );

  await detector.refresh();

  if (detector.getRoots().length > 0) {
    bootstrapLsp(loggerAdapter);
  }
}

async function importDetectedRoots(
  roots: readonly { folderPath: string }[],
  projectService: { importProject(path: string): Promise<unknown> },
): Promise<void> {
  for (const root of roots) {
    try {
      await projectService.importProject(root.folderPath);
    } catch (error) {
      baseLogger.warn(
        { folder: root.folderPath, error: (error as Error).message },
        'Failed to link vnext workspace into project registry',
      );
    }
  }
}

export function deactivate(): void {
  // No-op: all disposables are registered on context.subscriptions.
}
