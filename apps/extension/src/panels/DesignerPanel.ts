import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { VnextWorkspaceConfig } from '@vnext-forge/services-core';
import {
  getVnextComponentEditorTabDisplayTitle,
  getVnextComponentTabIconFileName,
  type VnextComponentTabKind,
} from '@vnext-forge/vnext-types';

import type { FileRouteKind } from '../file-router';
import type { MessageRouter } from '../MessageRouter';

/**
 * Editor kinds the designer panel knows how to render. `'unknown'` is
 * deliberately excluded — bilinmeyen dosyalar VS Code'un yerleşik editörüne
 * yönlendirilir (bkz. `commands.ts`). `'config'` (vnext.config.json) artık
 * `WorkspaceConfigEditorView` ile designer içinde açılır.
 */
export type DesignerEditorKind = Exclude<FileRouteKind, 'unknown'>;

/**
 * Host -> webview message that tells the webview UI which designer editor to
 * render. The webview no longer carries a router, so we describe the editor
 * declaratively (kind + ids) and the webview picks the matching component.
 */
export interface DesignerOpenEditorMessage {
  type: 'open-editor';
  kind: DesignerEditorKind;
  /** Project id used by `useProjectStore` to scope subsequent requests. */
  projectId: string;
  /** Absolute workspace path of the project. */
  projectPath: string;
  /** Domain name read from `vnext.config.json`. */
  projectDomain: string;
  /** Component group (folder under the editor's root). */
  group: string;
  /** Component file name (without `.json`). */
  name: string;
  /** Absolute file path the user opened, kept for diagnostics. */
  filePath: string;
  /** Full `vnext.config.json` — hydrates `useProjectStore.vnextConfig`. */
  vnextConfig: VnextWorkspaceConfig;
}

const EMPTY_DESIGNER_PANEL_KEY = '__vnext_forge_landing__';

function normalizeFilePanelKey(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/').toLowerCase();
}

function isWebviewReadyMessage(raw: unknown): boolean {
  return (
    typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'webview-ready'
  );
}

interface ManagedWebview {
  panel: vscode.WebviewPanel;
  webviewReady: boolean;
  pendingOpen: DesignerOpenEditorMessage | undefined;
  /**
   * `true` when the panel was created by VS Code (custom editor) — in that
   * case the panel lifecycle is owned by VS Code and we must not call
   * `panel.dispose()` ourselves on tab churn (e.g. landing → file).
   */
  externallyOwned: boolean;
}

/**
 * Her bileşen dosyası ayrı bir {@link vscode.WebviewPanel} — VS Code’da ayrı editör
 * sekmeleri. Aynı dosya tekrar açılırsa mevcut panel `reveal` edilir.
 */
export class DesignerPanel {
  private readonly panels = new Map<string, ManagedWebview>();
  private readonly context: vscode.ExtensionContext;
  private readonly router: MessageRouter;

  constructor(context: vscode.ExtensionContext, router: MessageRouter) {
    this.context = context;
    this.router = router;
  }

  /**
   * Boş “Designer” görünümü (komut paleti). Tek bir landing paneli; zaten
   * varsa `reveal`.
   */
  openOrRevealEmpty(): void {
    const existing = this.panels.get(EMPTY_DESIGNER_PANEL_KEY);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    this.createWebviewForKey(EMPTY_DESIGNER_PANEL_KEY, 'vnext-forge Designer', undefined);
  }

  /**
   * Bileşen editörü: dosya yolu başına bir VS Code sekmesi (webview panel).
   */
  openEditor(message: DesignerOpenEditorMessage): void {
    const fileKey = normalizeFilePanelKey(message.filePath);

    const existing = this.panels.get(fileKey);
    if (existing) {
      this.revealAndSendOpen(existing, message);
      return;
    }

    // Yalnızca landing paneli açıksa onu bu dosyaya dönüştür (fazla boş sekme biriktirme).
    const landingOnly = this.panels.size === 1 && this.panels.has(EMPTY_DESIGNER_PANEL_KEY);
    if (landingOnly) {
      const landing = this.panels.get(EMPTY_DESIGNER_PANEL_KEY)!;
      this.panels.delete(EMPTY_DESIGNER_PANEL_KEY);
      this.panels.set(fileKey, landing);
      this.setPanelLabelForComponent(landing.panel, message);
      this.revealAndSendOpen(landing, message);
      return;
    }

    const title = getVnextComponentEditorTabDisplayTitle(message.name, {
      storedTitleWithJson: `${message.name}.json`,
    });
    this.createWebviewForKey(fileKey, title, message);
  }

  /**
   * Adopt a {@link vscode.WebviewPanel} created by VS Code (e.g. via a
   * `CustomTextEditorProvider`) and render the matching designer editor
   * inside it. Unlike {@link openEditor}, the panel lifecycle is owned by
   * VS Code, so we never call `panel.dispose()` ourselves and we never
   * recycle the landing panel — the panel was opened directly for this
   * specific file by the user clicking it in the Explorer.
   *
   * Returns a disposable that detaches our routing/listeners when the
   * panel is closed by VS Code.
   */
  adoptWebviewPanel(
    panel: vscode.WebviewPanel,
    message: DesignerOpenEditorMessage,
  ): vscode.Disposable {
    const fileKey = normalizeFilePanelKey(message.filePath);

    // Defensive: if we somehow already track a panel for this file (e.g.
    // an old webview-panel from `openEditor`), the new VS Code-owned
    // panel takes over — drop the stale entry without disposing the
    // existing panel (VS Code will close duplicates as it sees fit).
    this.panels.delete(fileKey);

    this.setPanelLabelForComponent(panel, message);

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui')],
    };

    const managed: ManagedWebview = {
      panel,
      webviewReady: false,
      pendingOpen: message,
      externallyOwned: true,
    };
    this.panels.set(fileKey, managed);

    return this.attachWebviewLifecycle(fileKey, managed);
  }

  private revealAndSendOpen(managed: ManagedWebview, message: DesignerOpenEditorMessage): void {
    this.setPanelLabelForComponent(managed.panel, message);
    managed.panel.reveal(vscode.ViewColumn.Active);
    if (managed.webviewReady) {
      void managed.panel.webview.postMessage(message);
    } else {
      managed.pendingOpen = message;
    }
  }

  private setPanelLabelForComponent(
    panel: vscode.WebviewPanel,
    message: Pick<DesignerOpenEditorMessage, 'kind' | 'name'>,
  ): void {
    const kind = message.kind as VnextComponentTabKind;
    panel.title = getVnextComponentEditorTabDisplayTitle(message.name, {
      storedTitleWithJson: `${message.name}.json`,
    });
    panel.iconPath = this.buildTabIconPath(kind);
  }

  /**
   * VS Code tab ikonları için tema duyarlı `iconPath`.
   * `currentColor` SVG sekme ikonlarında işlenmediği için light/dark
   * varyantları ayrı dosyalar olarak `sync-component-tab-icons` betiği
   * tarafından üretilir (bkz. `apps/extension/scripts/`).
   */
  private buildTabIconPath(kind: VnextComponentTabKind): { light: vscode.Uri; dark: vscode.Uri } {
    const baseName = getVnextComponentTabIconFileName(kind).replace(/\.svg$/i, '');
    return {
      light: vscode.Uri.joinPath(
        this.context.extensionUri,
        'media',
        'component-tab-icons',
        `${baseName}-light.svg`,
      ),
      dark: vscode.Uri.joinPath(
        this.context.extensionUri,
        'media',
        'component-tab-icons',
        `${baseName}-dark.svg`,
      ),
    };
  }

  private createWebviewForKey(
    key: string,
    title: string,
    initial: DesignerOpenEditorMessage | undefined,
  ): void {
    const panel = vscode.window.createWebviewPanel('vnextForge', title, vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui')],
    });

    if (initial) {
      this.setPanelLabelForComponent(panel, initial);
    } else {
      panel.iconPath = undefined;
    }

    const managed: ManagedWebview = {
      panel,
      webviewReady: false,
      pendingOpen: initial,
      externallyOwned: false,
    };
    this.panels.set(key, managed);

    this.attachWebviewLifecycle(key, managed);
  }

  /**
   * Wire the message router, ready signal, tab-chrome relay and HTML
   * payload onto a managed webview, then register a disposal hook that
   * cleans up our listeners when VS Code closes the panel.
   *
   * Returns a disposable that releases the listeners early if a caller
   * (e.g. the custom-editor provider) needs to detach before VS Code
   * fires `onDidDispose`.
   */
  private attachWebviewLifecycle(key: string, managed: ManagedWebview): vscode.Disposable {
    const { panel } = managed;
    const routerDisposable = this.router.attach(panel);

    const readyDisposable = panel.webview.onDidReceiveMessage((raw: unknown) => {
      if (isWebviewReadyMessage(raw)) {
        managed.webviewReady = true;
        if (managed.pendingOpen) {
          void panel.webview.postMessage(managed.pendingOpen);
          managed.pendingOpen = undefined;
        }
      }
    });

    const chromeDisposable = panel.webview.onDidReceiveMessage((raw: unknown) => {
      this.applyWebviewTabChromeIfHostFrame(panel, raw);
    });

    panel.webview.html = this.buildHtml(panel.webview);

    let detached = false;
    const detach = () => {
      if (detached) return;
      detached = true;
      try {
        routerDisposable.dispose();
      } catch {
        /* ignore */
      }
      try {
        readyDisposable.dispose();
      } catch {
        /* ignore */
      }
      try {
        chromeDisposable.dispose();
      } catch {
        /* ignore */
      }
      if (this.panels.get(key) === managed) {
        this.panels.delete(key);
      }
    };

    panel.onDidDispose(detach, null, this.context.subscriptions);

    return new vscode.Disposable(detach);
  }

  private applyWebviewPanelTabChromeFromKindAndName(
    panel: vscode.WebviewPanel,
    kind: VnextComponentTabKind,
    componentName: string,
  ): void {
    panel.title = getVnextComponentEditorTabDisplayTitle(componentName, {
      storedTitleWithJson: `${componentName}.json`,
    });
    panel.iconPath = this.buildTabIconPath(kind);
  }

  private applyWebviewTabChromeIfHostFrame(panel: vscode.WebviewPanel, raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return;
    if ((raw as { type?: unknown }).type !== 'host:designer-active-tab') return;
    const rec = raw as { kind?: unknown; name?: unknown };
    if (typeof rec.kind !== 'string' || typeof rec.name !== 'string') return;
    this.applyWebviewPanelTabChromeFromKindAndName(
      panel,
      rec.kind as VnextComponentTabKind,
      rec.name,
    );
  }

  private buildHtml(webview: vscode.Webview): string {
    const webviewDistPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui');

    const indexHtmlPath = vscode.Uri.joinPath(webviewDistPath, 'index.html').fsPath;
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    html = html.replace(
      /((?:src|href)=")(\.?\/?assets\/[^"]+)(")/g,
      (_match, prefix, assetPath, suffix) => {
        const cleanPath = (assetPath as string).replace(/^\.?\/?/, '');
        const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDistPath, cleanPath));
        return `${prefix}${assetUri}${suffix}`;
      },
    );

    const nonce = generateNonce();

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`,
      `worker-src blob:`,
      `font-src ${webview.cspSource} data:`,
      `img-src ${webview.cspSource} data:`,
      `connect-src ${webview.cspSource}`,
    ].join('; ');

    const configScript = `<script nonce="${nonce}">
  window.__VNEXT_CONFIG__ = ${JSON.stringify(buildWebviewConfig())};
</script>`;

    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;

    // Inline boot loader visible BEFORE React mounts. Avoids the blank flash
    // (or worse, the underlying VS Code text editor flash when the custom
    // editor takes over a JSON tab) that the user sees while the webview
    // bundle downloads, parses and hydrates.
    const loadingStyle = `<style nonce="${nonce}">
  .vnext-forge-boot { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); font-family: var(--vscode-font-family, system-ui, sans-serif); font-size: 12px; z-index: 0; transition: opacity 160ms ease-out; }
  .vnext-forge-boot.is-fading { opacity: 0; pointer-events: none; }
  .vnext-forge-boot .vnext-forge-spinner { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--vscode-editorWidget-border, #3c3c3c); border-top-color: var(--vscode-progressBar-background, #0e639c); animation: vnext-forge-spin 0.9s linear infinite; }
  @keyframes vnext-forge-spin { to { transform: rotate(360deg); } }
</style>`;

    const loadingMarkup = `<div class="vnext-forge-boot" id="vnext-forge-boot" role="status" aria-live="polite">
  <div class="vnext-forge-spinner" aria-hidden="true"></div>
  <div>vnext-forge Designer yükleniyor…</div>
</div>`;

    const loadingTeardownScript = `<script nonce="${nonce}">
  (function () {
    function dismiss() {
      var el = document.getElementById('vnext-forge-boot');
      if (!el) return;
      el.classList.add('is-fading');
      setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 220);
    }
    var attempts = 0;
    function check() {
      attempts++;
      var root = document.getElementById('root');
      if (root && root.firstChild) { dismiss(); return; }
      if (attempts > 600) { dismiss(); return; }
      requestAnimationFrame(check);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', check, { once: true });
    } else {
      check();
    }
  })();
</script>`;

    html = html.replace(/<script(\s[^>]*)?>/g, (match, attrs = '') => {
      if (/nonce=/.test(attrs)) return match;
      if (/src=/.test(attrs)) return `<script${attrs} nonce="${nonce}">`;
      return `<script${attrs} nonce="${nonce}">`;
    });

    html = html.replace(
      '</head>',
      `${cspMeta}\n${configScript}\n${loadingStyle}\n</head>`,
    );

    html = html.replace('<body>', `<body>\n${loadingMarkup}\n${loadingTeardownScript}\n`);

    return html;
  }
}

/**
 * Build the runtime config blob injected into the webview as
 * `window.__VNEXT_CONFIG__`. The webview communicates with the host
 * over `postMessage` (no HTTP), so we deliberately do NOT inject any
 * URL-shaped fields — older versions hardcoded `https://localhost/api`
 * here, which gave security reviewers a false signal that the webview
 * was talking to a real network endpoint.
 */
function buildWebviewConfig(): Record<string, unknown> {
  const revalidationSeconds = vscode.workspace
    .getConfiguration('vnextForge')
    .get<number>('runtimeRevalidationMinIntervalSeconds', 30);
  return {
    RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: revalidationSeconds,
    /** Webview `postMessage` origin allowlist (API + LSP); merged with defaults in webview boot. */
    POST_MESSAGE_ALLOWED_ORIGINS: ['vscode-webview:', 'vscode-file://vscode-app'],
  };
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
}
