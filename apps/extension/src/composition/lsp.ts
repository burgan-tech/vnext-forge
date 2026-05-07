/**
 * Extension-side entry for `@vnext-forge-studio/lsp-core`. Re-exports the shared
 * factory so callers never import `createOmniSharpInstaller` directly in two
 * places (R-b8).
 */
export {
  createExtensionHostLspStack,
  type LspBridge,
} from '@vnext-forge-studio/lsp-core';
