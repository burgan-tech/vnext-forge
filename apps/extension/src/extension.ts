import * as vscode from 'vscode';

import { registerComponentJsonAutoOpen } from './component-json-auto-open.js';
import { registerCommands } from './commands.js';
import { createExtensionHostLspStack } from './composition/lsp.js';
import { composeExtensionServices } from './composition/services.js';
import { bootstrapLsp } from './lsp-bootstrap.js';
import { MessageRouter } from './MessageRouter.js';
import { createVsCodeOutputChannelLogger } from './adapters/vscode-output-channel-logger.js';
import { baseLogger } from './shared/logger.js';
import { DesignerPanel } from './panels/DesignerPanel.js';
import { VnextWorkspaceDetector } from './workspace-detector.js';

/**
 * vnext-forge extension entry point. Composes the shared `services-core` +
 * `lsp-core` packages with VS Code-specific adapters (workspace root
 * resolver, OutputChannel logger, webview `postMessage` transport) and wires
 * the resulting services to commands and the webview `MessageRouter`.
 *
 * LSP / OmniSharp lifecycle owner: `createExtensionHostLspStack` in
 * `@vnext-forge/lsp-core` constructs the single shared `OmniSharpInstaller` and
 * `LspBridge`. The extension only re-exports that factory from
 * `composition/lsp.ts` and passes the same installer into `bootstrapLsp` for
 * background pre-download — there is no second installer factory in the
 * extension host (R-b8).
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  baseLogger.info({}, 'vnext-forge activating');

  const outputChannel = vscode.window.createOutputChannel('vnext-forge-core');
  context.subscriptions.push(outputChannel);
  const loggerAdapter = createVsCodeOutputChannelLogger(outputChannel);

  // Dedicated channel for webview-side designer-ui logs forwarded via the
  // `host:log` postMessage tunnel. Keeping it separate from the core channel
  // makes it trivial to filter "what happened in the editor UI" vs "what
  // happened in the extension host".
  const webviewLogChannel = vscode.window.createOutputChannel('vnext-forge:webview');
  context.subscriptions.push(webviewLogChannel);

  const { services, registry } = composeExtensionServices(loggerAdapter);
  const { bridge: lspBridge, installer: lspInstaller } =
    createExtensionHostLspStack(loggerAdapter);

  const router = new MessageRouter({
    registry,
    services,
    lspBridge,
    logger: loggerAdapter,
    webviewLogChannel,
  });
  const designerPanel = new DesignerPanel(context, router);

  const detector = new VnextWorkspaceDetector(services.workspaceService);
  context.subscriptions.push(detector);

  registerCommands(context, {
    projectService: services.projectService,
    workspaceService: services.workspaceService,
    detector,
    designerPanel,
  });

  registerComponentJsonAutoOpen(context, {
    detector,
    designerPanel,
    workspaceService: services.workspaceService,
    projectService: services.projectService,
  });

  context.subscriptions.push(
    detector.onDidChange((roots) => {
      void importDetectedRoots(roots, services.projectService);
    }),
  );

  await detector.refresh();

  if (detector.getRoots().length > 0) {
    bootstrapLsp(loggerAdapter, lspInstaller);
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
