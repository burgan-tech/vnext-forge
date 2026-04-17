import {
  createLspBridge,
  createLspWorkspaceManager,
  createOmniSharpInstaller,
  type LspBridge,
} from '@vnext-forge/lsp-core';
import type { LoggerAdapter } from '@vnext-forge/services-core';

/**
 * Wire up the shared LSP core for the VS Code extension host. The bridge is
 * transport-agnostic; the webview `postMessage` transport is plugged in per
 * editor session by `src/webview/webview-lsp-transport.ts`.
 */
export function composeExtensionLspBridge(logger: LoggerAdapter): LspBridge {
  const installer = createOmniSharpInstaller({ logger });
  const workspaceManager = createLspWorkspaceManager({ logger });
  return createLspBridge({ logger, installer, workspaceManager });
}
