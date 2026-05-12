import * as fs from 'node:fs';
import * as vscode from 'vscode';

import type { MessageRouter } from '../MessageRouter';
import { DataBucketService, type WorkflowBucketConfig } from '../tools/data-bucket.service.js';
import type { EnvironmentHealthMonitor } from '../tools/environment-health-monitor.js';
import type { ForgeToolsSettingsService } from '../tools/forge-tools-settings.js';

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
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui'),
        ],
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

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`,
      `worker-src ${webview.cspSource} blob:`,
      `font-src ${webview.cspSource} data:`,
      `img-src ${webview.cspSource} data:`,
      `connect-src ${webview.cspSource}`,
    ].join('; ');

    const webviewConfig = this.buildWebviewConfig();
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

  private buildWebviewConfig(): Record<string, unknown> {
    return {
      POST_MESSAGE_ALLOWED_ORIGINS: ['vscode-webview:', 'vscode-file://vscode-app'],
    };
  }
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
}
