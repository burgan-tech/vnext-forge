import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

import type { MessageRouter } from '../MessageRouter';
import { DataBucketService, type WorkflowBucketConfig } from '../tools/data-bucket.service.js';
import type { EnvironmentHealthMonitor } from '../tools/environment-health-monitor.js';
import type { ForgeSettings, ForgeToolsSettingsService } from '../tools/forge-tools-settings.js';

export interface QuickRunContext {
  domain: string;
  workflowKey: string;
  projectId: string;
  projectPath: string;
  environmentName?: string;
  environmentUrl?: string;
  /**
   * Workflow's `attributes.startTransition.schema` reference, if any.
   * Forwarded to `QuickRunShell` so `NewRunDialog` can faker-fill the
   * start payload through `test-data/generateForSchemaReference`. When
   * absent the dialog falls back to manual JSON entry only.
   */
  startSchemaRef?: {
    key: string;
    version: string;
    flow?: string;
    domain?: string;
  };
}

function isWebviewReadyMessage(raw: unknown): boolean {
  return (
    typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'webview-ready'
  );
}

/**
 * Manages QuickRun WebviewPanel instances. Each `${domain}:${workflowKey}`
 * gets its own independent webview so authors can inspect multiple
 * flows side-by-side. Re-opening Quick Run for a workflow that's
 * already showing reveals that panel rather than creating a duplicate.
 */
interface PanelEntry {
  panel: vscode.WebviewPanel;
  webviewReady: boolean;
  pendingContext: QuickRunContext | undefined;
  disposables: vscode.Disposable[];
}

export class QuickRunPanel {
  // Keyed by `${domain}:${workflowKey}` — see `keyFor`. Each entry's
  // disposables list owns the listeners attached to that single
  // panel; `onDidDispose` removes the entry and drains the list.
  private readonly panels = new Map<string, PanelEntry>();
  private readonly dataBucket: DataBucketService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly router: MessageRouter,
    private readonly forgeToolsSettings?: ForgeToolsSettingsService,
    private readonly healthMonitor?: EnvironmentHealthMonitor,
  ) {
    this.dataBucket = new DataBucketService(context.globalStorageUri);
  }

  private keyFor(ctx: QuickRunContext): string {
    return `${ctx.domain}:${ctx.workflowKey}`;
  }

  open(ctx: QuickRunContext): void {
    const key = this.keyFor(ctx);
    const existing = this.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Active);
      // Even though the key already matches, the ctx may carry fresh
      // environment / project info — re-send so the webview reflects
      // the latest active environment selection.
      if (existing.webviewReady) {
        void this.sendContextWithPolling(existing, ctx);
      } else {
        existing.pendingContext = ctx;
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'vnextForgeQuickRun',
      `Quick Run — ${ctx.workflowKey}`,
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
      disposables: [],
    };
    this.panels.set(key, entry);

    entry.disposables.push(this.router.attach(panel));

    entry.disposables.push(
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        if (isWebviewReadyMessage(raw)) {
          entry.webviewReady = true;
          if (entry.pendingContext) {
            void this.sendContextWithPolling(entry, entry.pendingContext);
            entry.pendingContext = undefined;
          }
          this.sendCurrentHealthTo(entry);
          return;
        }
        void this.handleDataBucketMessage(entry, raw);
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
    }

    if (this.healthMonitor) {
      entry.disposables.push(
        this.healthMonitor.onDidChangeHealth((status) => {
          this.postHealthTo(
            entry,
            status === 'healthy' ? 'healthy' : status === 'unhealthy' ? 'unhealthy' : 'unknown',
          );
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
    // Each panel's onDidDispose handler removes its own entry from
    // the map and disposes its listeners, so we just trigger the
    // close. Iterate over a snapshot to avoid concurrent-modification
    // surprises.
    for (const entry of [...this.panels.values()]) {
      entry.panel.dispose();
    }
  }

  private async handleDataBucketMessage(entry: PanelEntry, raw: unknown): Promise<void> {
    if (typeof raw !== 'object' || raw === null) return;
    const msg = raw as { type?: string; requestId?: string; domain?: string; workflowKey?: string; config?: WorkflowBucketConfig };

    if (msg.type === 'databucket:saveConfig' && msg.domain && msg.workflowKey && msg.config) {
      await this.dataBucket.saveConfig(msg.domain, msg.workflowKey, msg.config);
      if (msg.requestId) {
        void entry.panel.webview.postMessage({ type: 'databucket:saveConfig:response', requestId: msg.requestId, success: true });
      }
      return;
    }

    if (msg.type === 'databucket:loadConfig' && msg.domain && msg.workflowKey) {
      const config = await this.dataBucket.loadConfig(msg.domain, msg.workflowKey);
      if (msg.requestId) {
        void entry.panel.webview.postMessage({ type: 'databucket:loadConfig:response', requestId: msg.requestId, config });
      }
    }
  }

  private sendCurrentHealthTo(entry: PanelEntry): void {
    if (!this.healthMonitor) return;
    const h = this.healthMonitor.getHealth();
    const mapped = h === 'healthy' ? 'healthy' : h === 'unhealthy' ? 'unhealthy' : 'unknown';
    this.postHealthTo(entry, mapped);
  }

  private postHealthTo(entry: PanelEntry, status: 'healthy' | 'unhealthy' | 'unknown'): void {
    if (!entry.webviewReady) return;
    const runtimeDomain = this.healthMonitor?.getRuntimeDomain() ?? undefined;
    void entry.panel.webview.postMessage({ type: 'quickrun:health', status, runtimeDomain });
  }

  private async sendContextWithPolling(entry: PanelEntry, ctx: QuickRunContext): Promise<void> {
    let pollingRetryCount: number | undefined;
    let pollingIntervalMs: number | undefined;
    if (this.forgeToolsSettings) {
      const qr = await this.forgeToolsSettings.loadQuickRunSettings();
      pollingRetryCount = qr.polling.retryCount;
      pollingIntervalMs = qr.polling.intervalMs;
    }
    void entry.panel.webview.postMessage({
      type: 'quickrun:context',
      ...ctx,
      pollingRetryCount,
      pollingIntervalMs,
    });
  }

  private buildHtml(webview: vscode.Webview): string {
    const webviewDistPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui');
    const htmlPath = vscode.Uri.joinPath(webviewDistPath, 'quickrun.html').fsPath;
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

    const csp = [
      `default-src 'none'`,
      `style-src ${[webview.cspSource, tenantStyleCspSource, "'unsafe-inline'"].filter(Boolean).join(' ')}`,
      `script-src 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`,
      // The pseudo-ui preview renders inside a same-origin `<iframe srcdoc>`
      // for CSS cascade isolation (see PseudoUiPseudoViewFrame.tsx). Without
      // an explicit `frame-src`, the `default-src 'none'` fallback blocks
      // iframe creation entirely.
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
