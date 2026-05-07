import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { VnextWorkspaceConfig } from '@vnext-forge-studio/services-core';
import {
  getVnextComponentEditorTabDisplayTitle,
  getVnextComponentTabIconFileName,
  type VnextComponentTabKind,
} from '@vnext-forge-studio/vnext-types';

import type { FileRouteKind } from '../file-router';
import type { MessageRouter } from '../MessageRouter';
import type { ForgeToolsSettingsService } from '../tools/forge-tools-settings.js';

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
  lifecycleDisposable?: vscode.Disposable;
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
  private forgeToolsSettings: ForgeToolsSettingsService | undefined;
  private settingsChangeDisposable: vscode.Disposable | undefined;

  constructor(context: vscode.ExtensionContext, router: MessageRouter) {
    this.context = context;
    this.router = router;
  }

  /**
   * Wire the sidebar settings service so canvas/theme changes are
   * injected into new webviews and broadcast to already-open ones.
   */
  setForgeToolsSettings(service: ForgeToolsSettingsService): void {
    this.settingsChangeDisposable?.dispose();
    this.forgeToolsSettings = service;
    this.settingsChangeDisposable = service.onDidChangeSettings((settings) => {
      const message = {
        type: 'host:canvas-settings-changed',
        canvasViewSettings: settings.canvas,
        themeMode: settings.themeMode,
      };
      for (const managed of this.panels.values()) {
        if (managed.webviewReady) {
          void managed.panel.webview.postMessage(message);
        }
      }
    });
    this.context.subscriptions.push(this.settingsChangeDisposable);
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
    this.createWebviewForKey(EMPTY_DESIGNER_PANEL_KEY, 'vnext-forge-studio Designer', undefined);
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
    // panel takes over. Detach our old listeners without disposing the
    // existing panel (VS Code will close duplicates as it sees fit).
    this.panels.get(fileKey)?.lifecycleDisposable?.dispose();
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

    const lifecycleDisposable = this.attachWebviewLifecycle(fileKey, managed);
    managed.lifecycleDisposable = lifecycleDisposable;
    return lifecycleDisposable;
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
   * İkon kaynakları `packages/designer-ui/src/assets/icons/`; `sync-component-tab-icons`
   * betiği VS Code kısıtı için bunları `media/component-tab-icons/*.svg` olarak yazar
   * (`currentColor` sekme ikonlarında uygulanmadığından light/dark stroke üretilir).
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

    managed.lifecycleDisposable = this.attachWebviewLifecycle(key, managed);
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
    const disposables: vscode.Disposable[] = [];
    let detached = false;

    const detach = () => {
      if (detached) return;
      detached = true;
      for (const disposable of disposables) {
        try {
          disposable.dispose();
        } catch {
          /* ignore */
        }
      }
      if (this.panels.get(key) === managed) {
        this.panels.delete(key);
      }
    };

    disposables.push(this.router.attach(panel));

    disposables.push(
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        if (isWebviewReadyMessage(raw)) {
          managed.webviewReady = true;
          if (managed.pendingOpen) {
            void panel.webview.postMessage(managed.pendingOpen);
            managed.pendingOpen = undefined;
          }
        }
      }),
    );

    disposables.push(
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        this.applyWebviewTabChromeIfHostFrame(panel, raw);
      }),
    );

    disposables.push(
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        if (typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'host:open-quickrun') {
          const filePath = (raw as { filePath?: string }).filePath;
          if (filePath) {
            void vscode.commands.executeCommand('vnextForge.openQuickRunFromFile', vscode.Uri.file(filePath));
          }
        }
      }),
    );

    const disposeDisposable = panel.onDidDispose(detach);
    disposables.push(disposeDisposable);
    this.context.subscriptions.push(disposeDisposable);

    try {
      panel.webview.html = this.buildHtml(panel.webview);
    } catch (error) {
      detach();
      throw error;
    }

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

    // Inline boot loader visible BEFORE React mounts. Avoids the blank flash
    // (or worse, the underlying VS Code text editor flash when the custom
    // editor takes over a JSON tab) that the user sees while the webview
    // bundle downloads, parses and hydrates.
    const loadingStyle = `<style nonce="${nonce}">
  .vnext-forge-studio-boot { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); font-family: var(--vscode-font-family, system-ui, sans-serif); font-size: 12px; z-index: 0; transition: opacity 160ms ease-out; }
  .vnext-forge-studio-boot.is-fading { opacity: 0; pointer-events: none; }
  .vnext-forge-studio-boot .vnext-forge-studio-spinner { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--vscode-editorWidget-border, #3c3c3c); border-top-color: var(--vscode-progressBar-background, #0e639c); animation: vnext-forge-studio-spin 0.9s linear infinite; }
  @keyframes vnext-forge-studio-spin { to { transform: rotate(360deg); } }
</style>`;

    const loadingMarkup = `<div class="vnext-forge-studio-boot" id="vnext-forge-studio-boot" role="status" aria-live="polite">
  <div class="vnext-forge-studio-spinner" aria-hidden="true"></div>
  <div>Loading vnext-forge-studio Designer...</div>
</div>`;

    const loadingTeardownScript = `<script nonce="${nonce}">
  (function () {
    function dismiss() {
      var el = document.getElementById('vnext-forge-studio-boot');
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

    html = html.replace(/<script(\s[^>]*)?>/g, (match: string, attrs?: string) => {
      const scriptAttrs = attrs ?? '';
      if (scriptAttrs.includes('nonce=')) return match;
      if (scriptAttrs.includes('src=')) return `<script${scriptAttrs} nonce="${nonce}">`;
      return `<script${scriptAttrs} nonce="${nonce}">`;
    });

    html = html.replace(
      '</head>',
      `${cspMeta}\n${configScript}\n${loadingStyle}\n</head>`,
    );

    html = html.replace('<body>', `<body>\n${loadingMarkup}\n${loadingTeardownScript}\n`);

    return html;
  }

  /**
   * Build the runtime config blob injected into the webview as
   * `window.__VNEXT_CONFIG__`. The webview communicates with the host
   * over `postMessage` (no HTTP), so we deliberately do NOT inject any
   * URL-shaped fields.
   */
  private buildWebviewConfig(): Record<string, unknown> {
    const revalidationSeconds = vscode.workspace
      .getConfiguration('vnextForge')
      .get<number>('runtimeRevalidationMinIntervalSeconds', 30);
    const config: Record<string, unknown> = {
      RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: revalidationSeconds,
      POST_MESSAGE_ALLOWED_ORIGINS: ['vscode-webview:', 'vscode-file://vscode-app'],
    };

    const cached = this.forgeToolsSettings?.getCachedSettings();
    if (cached) {
      config.canvasViewSettings = cached.canvas;
      config.themeMode = cached.themeMode;
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
