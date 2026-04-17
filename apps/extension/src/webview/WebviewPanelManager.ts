import * as fs from 'node:fs'
import * as vscode from 'vscode'
import type { VnextWorkspaceConfig } from '@vnext-forge/services-core'

import type { FileRouteKind } from '../file-router'
import type { MessageRouter } from '../MessageRouter'

/**
 * Editor kinds the webview panel knows how to render. `'config'` and
 * `'unknown'` are deliberately excluded — those file types are opened in
 * VS Code's native editor instead (see `commands.ts`).
 */
export type WebviewEditorKind = Exclude<FileRouteKind, 'config' | 'unknown'>

/**
 * Host -> webview message that tells the webview which designer editor to
 * render. The webview no longer carries a router, so we describe the editor
 * declaratively (kind + ids) and the webview picks the matching component.
 */
export interface WebviewOpenEditorMessage {
  type: 'open-editor'
  kind: WebviewEditorKind
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

export class WebviewPanelManager {
  private panel: vscode.WebviewPanel | undefined
  private readonly context: vscode.ExtensionContext
  private readonly router: MessageRouter
  private pendingOpen: WebviewOpenEditorMessage | undefined
  private webviewReady = false

  constructor(context: vscode.ExtensionContext, router: MessageRouter) {
    this.context = context
    this.router = router
  }

  openOrReveal(): void {
    if (this.panel) {
      this.panel.reveal()
      return
    }

    this.panel = vscode.window.createWebviewPanel(
      'vnextForge',
      'vnext-forge Designer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        ],
      },
    )

    const routerDisposable = this.router.attach(this.panel)

    // Intercept 'ready' signals from the webview so we can flush a queued
    // open-editor message that arrived before the React tree mounted.
    const readyDisposable = this.panel.webview.onDidReceiveMessage((raw: unknown) => {
      if (
        typeof raw === 'object' &&
        raw !== null &&
        (raw as { type?: unknown }).type === 'webview-ready'
      ) {
        this.webviewReady = true
        if (this.pendingOpen) {
          this.panel?.webview.postMessage(this.pendingOpen)
          this.pendingOpen = undefined
        }
      }
    })

    this.panel.webview.html = this.buildHtml(this.panel.webview)

    this.panel.onDidDispose(
      () => {
        routerDisposable.dispose()
        readyDisposable.dispose()
        this.panel = undefined
        this.webviewReady = false
        this.pendingOpen = undefined
      },
      null,
      this.context.subscriptions,
    )
  }

  /**
   * Open the designer (creating the panel if needed) and tell the webview
   * which editor to render.
   */
  openEditor(message: WebviewOpenEditorMessage): void {
    this.openOrReveal()
    if (!this.panel) return
    if (this.webviewReady) {
      this.panel.webview.postMessage(message)
    } else {
      // Queue until the webview announces it is ready.
      this.pendingOpen = message
    }
  }

  private buildHtml(webview: vscode.Webview): string {
    const webviewDistPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'dist',
      'webview',
    )

    const indexHtmlPath = vscode.Uri.joinPath(webviewDistPath, 'index.html').fsPath
    let html = fs.readFileSync(indexHtmlPath, 'utf8')

    // Rewrite asset references to webview URIs. Vite emits relative paths
    // (`./assets/...`) when `base: ''`, so the regex must accept an optional
    // `./` prefix in addition to a leading `/` or no prefix at all.
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

function buildWebviewConfig(): Record<string, unknown> {
  return {
    ENVIRONMENT: 'PRODUCTION',
    API_URL: 'https://localhost/api',
    API_URL_DEVELOPMENT: 'https://localhost/api',
    RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: 30,
  }
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('')
}
