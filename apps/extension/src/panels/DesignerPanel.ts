import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'
import type { VnextWorkspaceConfig } from '@vnext-forge/services-core'
import {
  getVnextComponentEditorTabDisplayTitle,
  getVnextComponentTabIconFileName,
  type VnextComponentTabKind,
} from '@vnext-forge/vnext-types'

import type { FileRouteKind } from '../file-router'
import type { MessageRouter } from '../MessageRouter'

/**
 * Editor kinds the designer panel knows how to render. `'config'` and
 * `'unknown'` are deliberately excluded — those file types are opened in
 * VS Code's native editor instead (see `commands.ts`).
 */
export type DesignerEditorKind = Exclude<FileRouteKind, 'config' | 'unknown'>

/**
 * Host -> webview message that tells the webview UI which designer editor to
 * render. The webview no longer carries a router, so we describe the editor
 * declaratively (kind + ids) and the webview picks the matching component.
 */
export interface DesignerOpenEditorMessage {
  type: 'open-editor'
  kind: DesignerEditorKind
  /** Project id used by `useProjectStore` to scope subsequent requests. */
  projectId: string
  /** Absolute workspace path of the project. */
  projectPath: string
  /** Domain name read from `vnext.config.json`. */
  projectDomain: string
  /** Component group (folder under the editor's root). */
  group: string
  /** Component file name (without `.json`). */
  name: string
  /** Absolute file path the user opened, kept for diagnostics. */
  filePath: string
  /** Full `vnext.config.json` — hydrates `useProjectStore.vnextConfig`. */
  vnextConfig: VnextWorkspaceConfig
}

const EMPTY_DESIGNER_PANEL_KEY = '__vnext_forge_landing__'

function normalizeFilePanelKey(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/').toLowerCase()
}

function isWebviewReadyMessage(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { type?: unknown }).type === 'webview-ready'
  )
}

interface ManagedWebview {
  panel: vscode.WebviewPanel
  webviewReady: boolean
  pendingOpen: DesignerOpenEditorMessage | undefined
}

/**
 * Her bileşen dosyası ayrı bir {@link vscode.WebviewPanel} — VS Code’da ayrı editör
 * sekmeleri. Aynı dosya tekrar açılırsa mevcut panel `reveal` edilir.
 */
export class DesignerPanel {
  private readonly panels = new Map<string, ManagedWebview>()
  private readonly context: vscode.ExtensionContext
  private readonly router: MessageRouter

  constructor(context: vscode.ExtensionContext, router: MessageRouter) {
    this.context = context
    this.router = router
  }

  /**
   * Boş “Designer” görünümü (komut paleti). Tek bir landing paneli; zaten
   * varsa `reveal`.
   */
  openOrRevealEmpty(): void {
    const existing = this.panels.get(EMPTY_DESIGNER_PANEL_KEY)
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Active)
      return
    }
    this.createWebviewForKey(EMPTY_DESIGNER_PANEL_KEY, 'vnext-forge Designer', undefined)
  }

  /**
   * Bileşen editörü: dosya yolu başına bir VS Code sekmesi (webview panel).
   */
  openEditor(message: DesignerOpenEditorMessage): void {
    const fileKey = normalizeFilePanelKey(message.filePath)

    const existing = this.panels.get(fileKey)
    if (existing) {
      this.revealAndSendOpen(existing, message)
      return
    }

    // Yalnızca landing paneli açıksa onu bu dosyaya dönüştür (fazla boş sekme biriktirme).
    const landingOnly =
      this.panels.size === 1 && this.panels.has(EMPTY_DESIGNER_PANEL_KEY)
    if (landingOnly) {
      const landing = this.panels.get(EMPTY_DESIGNER_PANEL_KEY)!
      this.panels.delete(EMPTY_DESIGNER_PANEL_KEY)
      this.panels.set(fileKey, landing)
      this.setPanelLabelForComponent(landing.panel, message)
      this.revealAndSendOpen(landing, message)
      return
    }

    const title = getVnextComponentEditorTabDisplayTitle(message.name, {
      storedTitleWithJson: `${message.name}.json`,
    })
    this.createWebviewForKey(fileKey, title, message)
  }

  private revealAndSendOpen(managed: ManagedWebview, message: DesignerOpenEditorMessage): void {
    this.setPanelLabelForComponent(managed.panel, message)
    managed.panel.reveal(vscode.ViewColumn.Active)
    if (managed.webviewReady) {
      void managed.panel.webview.postMessage(message)
    } else {
      managed.pendingOpen = message
    }
  }

  private setPanelLabelForComponent(
    panel: vscode.WebviewPanel,
    message: Pick<DesignerOpenEditorMessage, 'kind' | 'name'>,
  ): void {
    const kind = message.kind as VnextComponentTabKind
    panel.title = getVnextComponentEditorTabDisplayTitle(message.name, {
      storedTitleWithJson: `${message.name}.json`,
    })
    const iconFile = getVnextComponentTabIconFileName(kind)
    panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'media',
      'component-tab-icons',
      iconFile,
    )
  }

  private createWebviewForKey(
    key: string,
    title: string,
    initial: DesignerOpenEditorMessage | undefined,
  ): void {
    const panel = vscode.window.createWebviewPanel(
      'vnextForge',
      title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui'),
        ],
      },
    )

    if (initial) {
      this.setPanelLabelForComponent(panel, initial)
    } else {
      panel.iconPath = undefined
    }

    const managed: ManagedWebview = {
      panel,
      webviewReady: false,
      pendingOpen: initial,
    }
    this.panels.set(key, managed)

    const routerDisposable = this.router.attach(panel)

    const readyDisposable = panel.webview.onDidReceiveMessage((raw: unknown) => {
      if (isWebviewReadyMessage(raw)) {
        managed.webviewReady = true
        if (managed.pendingOpen) {
          void panel.webview.postMessage(managed.pendingOpen)
          managed.pendingOpen = undefined
        }
      }
    })

    const chromeDisposable = panel.webview.onDidReceiveMessage((raw: unknown) => {
      this.applyWebviewTabChromeIfHostFrame(panel, raw)
    })

    panel.webview.html = this.buildHtml(panel.webview)

    panel.onDidDispose(
      () => {
        routerDisposable.dispose()
        readyDisposable.dispose()
        chromeDisposable.dispose()
        this.panels.delete(key)
      },
      null,
      this.context.subscriptions,
    )
  }

  private applyWebviewPanelTabChromeFromKindAndName(
    panel: vscode.WebviewPanel,
    kind: VnextComponentTabKind,
    componentName: string,
  ): void {
    panel.title = getVnextComponentEditorTabDisplayTitle(componentName, {
      storedTitleWithJson: `${componentName}.json`,
    })
    const iconFile = getVnextComponentTabIconFileName(kind)
    panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'media',
      'component-tab-icons',
      iconFile,
    )
  }

  private applyWebviewTabChromeIfHostFrame(panel: vscode.WebviewPanel, raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    if ((raw as { type?: unknown }).type !== 'host:designer-active-tab') return
    const rec = raw as { kind?: unknown; name?: unknown }
    if (typeof rec.kind !== 'string' || typeof rec.name !== 'string') return
    this.applyWebviewPanelTabChromeFromKindAndName(
      panel,
      rec.kind as VnextComponentTabKind,
      rec.name,
    )
  }

  private buildHtml(webview: vscode.Webview): string {
    const webviewDistPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'dist',
      'webview-ui',
    )

    const indexHtmlPath = vscode.Uri.joinPath(webviewDistPath, 'index.html').fsPath
    let html = fs.readFileSync(indexHtmlPath, 'utf8')

    html = html.replace(
      /((?:src|href)=")(\.?\/?assets\/[^"]+)(")/g,
      (_match, prefix, assetPath, suffix) => {
        const cleanPath = (assetPath as string).replace(/^\.?\/?/, '')
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(webviewDistPath, cleanPath),
        )
        return `${prefix}${assetUri}${suffix}`
      },
    )

    const nonce = generateNonce()

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`,
      `worker-src blob:`,
      `font-src ${webview.cspSource} data:`,
      `img-src ${webview.cspSource} data:`,
      `connect-src ${webview.cspSource}`,
    ].join('; ')

    const configScript = `<script nonce="${nonce}">
  window.__VNEXT_CONFIG__ = ${JSON.stringify(buildWebviewConfig())};
</script>`

    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`

    html = html.replace(/<script(\s[^>]*)?>/g, (match, attrs = '') => {
      if (/nonce=/.test(attrs)) return match
      if (/src=/.test(attrs)) return `<script${attrs} nonce="${nonce}">`
      return `<script${attrs} nonce="${nonce}">`
    })

    html = html.replace('</head>', `${cspMeta}\n${configScript}\n</head>`)

    return html
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
    .get<number>('runtimeRevalidationMinIntervalSeconds', 30)
  return {
    RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: revalidationSeconds,
    /** Webview `postMessage` origin allowlist (API + LSP); merged with defaults in webview boot. */
    POST_MESSAGE_ALLOWED_ORIGINS: ['vscode-webview:', 'vscode-file://vscode-app'],
  }
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('')
}
