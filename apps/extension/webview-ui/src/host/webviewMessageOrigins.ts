interface VnextWebviewConfig {
  POST_MESSAGE_ALLOWED_ORIGINS?: string[];
}

const DEFAULT_ORIGINS = ['vscode-webview:', 'vscode-file://vscode-app'] as const;

/** Host-injected list from `DesignerPanel` `__VNEXT_CONFIG__` plus VS Code defaults. */
export function resolveWebviewPostMessageAllowedOrigins(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_ORIGINS];
  const cfg = (window as unknown as { __VNEXT_CONFIG__?: VnextWebviewConfig }).__VNEXT_CONFIG__;
  const injected = cfg?.POST_MESSAGE_ALLOWED_ORIGINS?.filter((o): o is string => typeof o === 'string') ?? [];
  return [...new Set([...injected, ...DEFAULT_ORIGINS])];
}
