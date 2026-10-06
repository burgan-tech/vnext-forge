import * as vscode from 'vscode';

import type { MessageRouter } from '../MessageRouter';
import type { ForgeToolsSettingsService } from '../tools/forge-tools-settings.js';
import { isOpenQuickRunFromMonitorMessage } from './monitor-messages.js';
import { buildWebviewHtml } from './webview-html.js';

export interface MonitorContext {
  domain: string;
  workflowKey: string;
  instanceId: string;
  instanceKey?: string;
  projectId: string;
  /** Absolute path of the local workflow JSON (Quick Run's `projectPath`). */
  workflowFilePath: string;
  environmentName?: string;
  environmentUrl?: string;
}

interface PanelEntry {
  panel: vscode.WebviewPanel;
  webviewReady: boolean;
  ctx: MonitorContext;
  disposables: vscode.Disposable[];
}

/** One read-only Instance Monitor panel per `${domain}:${instanceId}`, opened beside Quick Run. */
export class MonitorPanel {
  private readonly panels = new Map<string, PanelEntry>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly router: MessageRouter,
    private readonly forgeToolsSettings?: ForgeToolsSettingsService,
  ) {}

  open(ctx: MonitorContext): void {
    const key = `${ctx.domain}:${ctx.instanceId}`;
    const existing = this.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Beside);
      existing.ctx = ctx;
      if (existing.webviewReady) void this.sendContext(existing);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'vnextForgeMonitor',
      `Monitor — ${ctx.workflowKey} · ${ctx.instanceKey ?? ctx.instanceId.slice(0, 8)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui')],
      },
    );
    const entry: PanelEntry = { panel, webviewReady: false, ctx, disposables: [] };
    this.panels.set(key, entry);

    entry.disposables.push(this.router.attach(panel));
    entry.disposables.push(
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        if (typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'webview-ready') {
          entry.webviewReady = true;
          void this.sendContext(entry);
          return;
        }
        if (isOpenQuickRunFromMonitorMessage(raw)) {
          void vscode.commands.executeCommand('vnextForge.openQuickRunFromFile', vscode.Uri.file(entry.ctx.workflowFilePath));
        }
      }),
    );
    if (this.forgeToolsSettings) {
      entry.disposables.push(
        this.forgeToolsSettings.onDidChangeQuickRunSettings(() => {
          if (entry.webviewReady) void this.sendContext(entry);
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

    panel.webview.html = buildWebviewHtml(this.context.extensionUri, panel.webview, 'monitor.html', {
      POST_MESSAGE_ALLOWED_ORIGINS: ['vscode-webview:', 'vscode-file://vscode-app'],
    });
  }

  dispose(): void {
    for (const entry of [...this.panels.values()]) entry.panel.dispose();
  }

  private async sendContext(entry: PanelEntry): Promise<void> {
    let globalHeaders: Record<string, string> = {};
    if (this.forgeToolsSettings) {
      const qr = await this.forgeToolsSettings.loadQuickRunSettings();
      globalHeaders = Object.fromEntries(qr.globalHeaders.map((h) => [h.name, h.value]));
    }
    void entry.panel.webview.postMessage({ type: 'monitor:context', ...entry.ctx, globalHeaders });
  }
}
