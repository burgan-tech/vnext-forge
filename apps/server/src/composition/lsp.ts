import {
  createLspBridge,
  createLspWorkspaceManager,
  createOmniSharpInstaller,
  type LspBridge,
} from '@vnext-forge-studio/lsp-core';
import type { LoggerAdapter } from '@vnext-forge-studio/services-core';

/**
 * Wire up the shared LSP core for the standalone web server. The bridge
 * itself is transport-agnostic; the WebSocket adapter is plugged in per
 * connection by `apps/server/src/lsp/router.ts`.
 */
export function composeLspBridge(logger: LoggerAdapter): LspBridge {
  const installer = createOmniSharpInstaller({ logger });
  const workspaceManager = createLspWorkspaceManager({ logger });
  return createLspBridge({ logger, installer, workspaceManager });
}
