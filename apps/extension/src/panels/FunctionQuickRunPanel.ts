import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

import type { FunctionScope } from '@vnext-forge-studio/vnext-types';

import type { MessageRouter } from '../MessageRouter';
import type { ForgeSettings, ForgeToolsSettingsService } from '../tools/forge-tools-settings.js';

export interface FunctionQuickRunContext {
  domain: string;
  functionKey: string;
  scope: FunctionScope;
  runtimeUrl?: string;
  /**
   * Scope `F`/`I` binding, set when the runner is opened from a live instance
   * in the workflow Quick Run panel. Pre-fills the runner's scope fields
   * instead of making the developer retype what Quick Run already shows.
   */
  workflowKey?: string;
  instanceId?: string;
}

function isWebviewReadyMessage(raw: unknown): boolean {
  return (
    typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'webview-ready'
  );
}

/**
 * Manages Function Quick Run WebviewPanel instances. Each `${domain}:${functionKey}`
 * gets its own independent webview, mirroring `QuickRunPanel`'s one-panel-per-key
 * lifecycle. Re-opening the runner for a function that's already showing reveals
 * that panel rather than creating a duplicate.
 *
 * Deliberately simpler than `QuickRunPanel`: a function invoke is one
 * request/response with no instances, no polling, and no data-bucket config, so
 * this panel carries none of that — see the plan's "Simplifications versus the
 * workflow runner" note. It also never posts a health message: `FunctionRunShell`
 * has no runtime-health display to feed, unlike `QuickRunShell`.
 */
interface PanelEntry {
  panel: vscode.WebviewPanel;
  webviewReady: boolean;
  pendingContext: FunctionQuickRunContext | undefined;
  /** What this panel is showing — re-sent when Forge Tools headers change. */
  ctx: FunctionQuickRunContext;
  disposables: vscode.Disposable[];
}

export class FunctionQuickRunPanel {
  // Keyed by `${domain}:${functionKey}` — see `keyFor`.
  private readonly panels = new Map<string, PanelEntry>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly router: MessageRouter,
    private readonly forgeToolsSettings?: ForgeToolsSettingsService,
  ) {}

  /**
   * The instance is part of the key: a runner bound to one instance must not
   * be revealed (and silently re-pointed) when the user opens the same
   * function against a different instance, or from the domain-scoped entry
   * points that carry no binding at all.
   */
  private keyFor(ctx: FunctionQuickRunContext): string {
    return `${ctx.domain}:${ctx.functionKey}:${ctx.instanceId ?? ''}`;
  }

  open(ctx: FunctionQuickRunContext): void {
    const key = this.keyFor(ctx);
    const existing = this.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Active);
      existing.ctx = ctx;
      if (existing.webviewReady) {
        void this.sendContext(existing, ctx);
      } else {
        existing.pendingContext = ctx;
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'vnextForgeFunctionQuickRun',
      `Run Function — ${ctx.functionKey}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: this.buildLocalResourceRoots(),
      },
    );

    const entry: PanelEntry = {
      panel,
      webviewReady: false,
      pendingContext: ctx,
      ctx,
      disposables: [],
    };
    this.panels.set(key, entry);

    entry.disposables.push(this.router.attach(panel));

    entry.disposables.push(
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        if (isWebviewReadyMessage(raw)) {
          entry.webviewReady = true;
          if (entry.pendingContext) {
            void this.sendContext(entry, entry.pendingContext);
            entry.pendingContext = undefined;
          }
        }
      }),
    );

    if (this.forgeToolsSettings) {
      entry.disposables.push(
        this.forgeToolsSettings.onDidChangeSettings((settings) => {
          entry.panel.webview.options = {
            ...entry.panel.webview.options,
            localResourceRoots: this.buildLocalResourceRoots(settings),
          };
          if (entry.webviewReady) {
            void entry.panel.webview.postMessage({
              type: 'host:canvas-settings-changed',
              pseudoUiTenantStyle: this.resolvePseudoUiTenantStyleForWebview(entry.panel.webview, settings),
            });
          }
        }),
      );

      // See `QuickRunPanel`'s counterpart — an open runner must pick up a
      // header change without being closed and reopened.
      entry.disposables.push(
        this.forgeToolsSettings.onDidChangeQuickRunSettings(() => {
          if (entry.webviewReady) void this.sendContext(entry, entry.ctx);
        }),
      );
    }

    panel.onDidDispose(() => {
      for (const d of entry.disposables) {
        try { d.dispose(); } catch { /* ignore */ }
      }
      entry.disposables.length = 0;
      this.panels.delete(key);
    });

    panel.webview.html = this.buildHtml(panel.webview);
  }

  dispose(): void {
    for (const entry of [...this.panels.values()]) {
      entry.panel.dispose();
    }
  }

  private async sendContext(entry: PanelEntry, ctx: FunctionQuickRunContext): Promise<void> {
    let globalHeaders: Record<string, string> = {};
    if (this.forgeToolsSettings) {
      // Forge-wide headers (Task 19) — shared with the workflow Quick Run
      // panel, persisted in `quickrun-settings.json`. Forwarded on every
      // open so a header added in Forge Tools Settings while this panel is
      // already open is picked up on the next reveal.
      const qr = await this.forgeToolsSettings.loadQuickRunSettings();
      globalHeaders = Object.fromEntries(qr.globalHeaders.map((h) => [h.name, h.value]));
    }
    void entry.panel.webview.postMessage({
      type: 'functionrun:context',
      ...ctx,
      globalHeaders,
    });
  }

  private buildHtml(webview: vscode.Webview): string {
    const webviewDistPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui');
    const htmlPath = vscode.Uri.joinPath(webviewDistPath, 'functionrun.html').fsPath;
    let html = fs.readFileSync(htmlPath, 'utf8');

    html = html.replace(
      /((?:src|href)=")(\.?\/?assets\/[^"]+)(")/g,
      (_match, prefix, assetPath, suffix) => {
        const cleanPath = (assetPath as string).replace(/^\.?\/?/, '');
        const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDistPath, cleanPath));
        return `${prefix}${assetUri.toString()}${suffix}`;
      },
    );

    const nonce = generateNonce();
    const tenantStyleCspSource = this.getTenantStyleCspSource();

    // CSP is load-bearing for pseudo-ui (function input/output views render
    // through the same shadow-DOM pseudo-ui stack as the workflow runner) —
    // copied verbatim from `QuickRunPanel.buildHtml`. In particular
    // `frame-src 'self'` is required for the same-origin `<iframe srcdoc>`
    // pseudo-ui uses for CSS cascade isolation, and `worker-src ... blob:`
    // is required for the worker it spins up internally.
    const csp = [
      `default-src 'none'`,
      `style-src ${[webview.cspSource, tenantStyleCspSource, "'unsafe-inline'"].filter(Boolean).join(' ')}`,
      `script-src 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`,
      `frame-src 'self' ${webview.cspSource}`,
      `worker-src ${webview.cspSource} blob:`,
      `font-src ${webview.cspSource} data:`,
      `img-src ${webview.cspSource} data:`,
      `connect-src ${webview.cspSource}`,
    ].join('; ');

    const webviewConfig = this.buildWebviewConfig(webview);
    const configScript = `<script nonce="${nonce}">
  window.__VNEXT_CONFIG__ = ${JSON.stringify(webviewConfig)};
</script>`;

    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;

    html = html.replace(/<script(\s[^>]*)?>/g, (match: string, attrs?: string) => {
      const scriptAttrs = attrs ?? '';
      if (scriptAttrs.includes('nonce=')) return match;
      return `<script${scriptAttrs} nonce="${nonce}">`;
    });

    html = html.replace('</head>', `${cspMeta}\n${configScript}\n</head>`);

    return html;
  }

  private buildLocalResourceRoots(settings = this.forgeToolsSettings?.getCachedSettings()): vscode.Uri[] {
    const roots = [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui')];
    const style = settings?.pseudoUiTenantStyle;
    if (style?.enabled && style.sourceType === 'localFile' && style.value) {
      roots.push(vscode.Uri.file(path.dirname(style.value)));
    }
    return roots;
  }

  private resolvePseudoUiTenantStyleForWebview(
    webview: vscode.Webview,
    settings: ForgeSettings,
  ): ForgeSettings['pseudoUiTenantStyle'] {
    const style = settings.pseudoUiTenantStyle;
    if (!style.enabled || !style.value) return { ...style, value: '' };
    if (style.sourceType === 'localFile') {
      return {
        ...style,
        value: webview.asWebviewUri(vscode.Uri.file(style.value)).toString(),
      };
    }
    return style;
  }

  private getTenantStyleCspSource(settings = this.forgeToolsSettings?.getCachedSettings()): string | null {
    const style = settings?.pseudoUiTenantStyle;
    if (!style?.enabled || style.sourceType !== 'url' || !style.value) return null;
    try {
      const url = new URL(style.value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  private buildWebviewConfig(webview: vscode.Webview): Record<string, unknown> {
    const config: Record<string, unknown> = {
      POST_MESSAGE_ALLOWED_ORIGINS: ['vscode-webview:', 'vscode-file://vscode-app'],
    };
    const cached = this.forgeToolsSettings?.getCachedSettings();
    if (cached) {
      config.pseudoUiTenantStyle = this.resolvePseudoUiTenantStyleForWebview(webview, cached);
    }
    return config;
  }
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
}
