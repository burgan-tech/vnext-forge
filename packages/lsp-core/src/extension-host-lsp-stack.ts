import type { LoggerAdapter } from '@vnext-forge/services-core';

import { createLspBridge, type LspBridge } from './lsp-bridge.js';
import { createLspWorkspaceManager } from './lsp-workspace.js';
import {
  createOmniSharpInstaller,
  type OmniSharpInstaller,
} from './omnisharp-installer.js';

/**
 * Single construction site for the VS Code extension host LSP stack (R-b8):
 * one `OmniSharpInstaller` instance is shared by the bridge and by optional
 * bootstrap pre-install so lifecycle and cache paths stay coherent.
 */
export function createExtensionHostLspStack(logger: LoggerAdapter): {
  bridge: LspBridge;
  installer: OmniSharpInstaller;
} {
  const installer = createOmniSharpInstaller({ logger });
  const workspaceManager = createLspWorkspaceManager({ logger });
  const bridge = createLspBridge({ logger, installer, workspaceManager });
  return { bridge, installer };
}
