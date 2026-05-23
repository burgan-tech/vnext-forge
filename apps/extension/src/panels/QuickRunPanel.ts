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
 * Manages the QuickRun WebviewPanel. Only one QuickRun panel can be open at
 * a time. Opening a second time reveals the existing panel with updated context.
 */
export class QuickRunPanel {
  private panel: vscode.WebviewPanel | undefined;
  private webviewReady = false;
  private pendingContext: QuickRunContext | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly dataBucket: DataBucketService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly router: MessageRouter,
    private readonly forgeToolsSettings?: ForgeToolsSettingsService,
    private readonly healthMonitor?: EnvironmentHealthMonitor,
  ) {
    this.dataBucket = new DataBucketService(context.globalStorageUri);
  }

  open(ctx: QuickRunContext): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      this.sendContext(ctx);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'vnextForgeQuickRun',
      `Quick Run — ${ctx.workflowKey}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: this.buildLocalResourceRoots(),
      },
    );

    this.pendingContext = ctx;

    const routerDisposable = this.router.attach(this.panel);
    this.disposables.push(routerDisposable);

    const readyListener = this.panel.webview.onDidReceiveMessage((raw: unknown) => {
      if (isWebviewReadyMessage(raw)) {
        this.webviewReady = true;
        if (this.pendingContext) {
          this.sendContext(this.pendingContext);
          this.pendingContext = undefined;
        }
        this.sendCurrentHealth();
        return;
      }
      void this.handleDataBucketMessage(raw);
    });
    this.disposables.push(readyListener);

    if (this.forgeToolsSettings) {
      const settingsSub = this.forgeToolsSettings.onDidChangeSettings((settings) => {
        if (!this.panel) return;
        this.panel.webview.options = {
          ...this.panel.webview.options,
          localResourceRoots: this.buildLocalResourceRoots(settings),
        };
        if (this.webviewReady) {
          void this.panel.webview.postMessage({
            type: 'host:canvas-settings-changed',
            pseudoUiTenantStyle: this.resolvePseudoUiTenantStyleForWebview(this.panel.webview, settings),
          });
        }
      });
      this.disposables.push(settingsSub);
    }

    if (this.healthMonitor) {
      const healthSub = this.healthMonitor.onDidChangeHealth((status) => {
        this.postHealthToWebview(status === 'healthy' ? 'healthy' : status === 'unhealthy' ? 'unhealthy' : 'unknown');
      });
      this.disposables.push(healthSub);
    }

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.webviewReady = false;
      this.pendingContext = undefined;
      for (const d of this.disposables) {
        try { d.dispose(); } catch { /* ignore */ }
      }
      this.disposables.length = 0;
    });

    this.panel.webview.html = this.buildHtml(this.panel.webview);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async handleDataBucketMessage(raw: unknown): Promise<void> {
    if (typeof raw !== 'object' || raw === null) return;
    const msg = raw as { type?: string; requestId?: string; domain?: string; workflowKey?: string; config?: WorkflowBucketConfig };

    if (msg.type === 'databucket:saveConfig' && msg.domain && msg.workflowKey && msg.config) {
      await this.dataBucket.saveConfig(msg.domain, msg.workflowKey, msg.config);
      if (msg.requestId && this.panel) {
        void this.panel.webview.postMessage({ type: 'databucket:saveConfig:response', requestId: msg.requestId, success: true });
      }
      return;
    }

    if (msg.type === 'databucket:loadConfig' && msg.domain && msg.workflowKey) {
      const config = await this.dataBucket.loadConfig(msg.domain, msg.workflowKey);
      if (msg.requestId && this.panel) {
        void this.panel.webview.postMessage({ type: 'databucket:loadConfig:response', requestId: msg.requestId, config });
      }
    }
  }

  private sendCurrentHealth(): void {
    if (!this.healthMonitor) return;
    const h = this.healthMonitor.getHealth();
    const mapped = h === 'healthy' ? 'healthy' : h === 'unhealthy' ? 'unhealthy' : 'unknown';
    this.postHealthToWebview(mapped);
  }

  private postHealthToWebview(status: 'healthy' | 'unhealthy' | 'unknown'): void {
    if (!this.panel || !this.webviewReady) return;
    const runtimeDomain = this.healthMonitor?.getRuntimeDomain() ?? undefined;
    void this.panel.webview.postMessage({ type: 'quickrun:health', status, runtimeDomain });
  }

  private sendContext(ctx: QuickRunContext): void {
    if (!this.panel) return;
    if (!this.webviewReady) {
      this.pendingContext = ctx;
      return;
    }
    void this.sendContextWithPolling(ctx);
  }

  private async sendContextWithPolling(ctx: QuickRunContext): Promise<void> {
    if (!this.panel) return;
    let pollingRetryCount: number | undefined;
    let pollingIntervalMs: number | undefined;
    if (this.forgeToolsSettings) {
      const qr = await this.forgeToolsSettings.loadQuickRunSettings();
      pollingRetryCount = qr.polling.retryCount;
      pollingIntervalMs = qr.polling.intervalMs;
    }
    void this.panel.webview.postMessage({
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
