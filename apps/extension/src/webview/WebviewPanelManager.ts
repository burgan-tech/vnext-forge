import * as fs from 'node:fs'
import * as vscode from 'vscode'
import type { MessageRouter } from '../MessageRouter'
import type { FileRoute } from '../file-router'
import type { VnextWorkspaceConfig } from '@vnext-forge/vnext-types'

export interface WebviewNavigationMessage {
  type: 'navigate'
  route: FileRoute
  /** Project id used by the webview to resolve active project context. */
  projectId: string
  /** Absolute workspace path of the project. */
  projectPath: string
  /** Domain name read from vnext.config.json. */
  projectDomain: string
  /** Full vnext.config.json — hydrates useProjectStore.vnextConfig in the webview. */
  vnextConfig: VnextWorkspaceConfig
}

export class WebviewPanelManager {
  private panel: vscode.WebviewPanel | undefined
  private readonly context: vscode.ExtensionContext
  private readonly router: MessageRouter
  private pendingNavigation: WebviewNavigationMessage | undefined
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

    // Intercept 'ready' signals from the webview so we can flush queued navigations.
    const readyDisposable = this.panel.webview.onDidReceiveMessage((raw: unknown) => {
      if (
        typeof raw === 'object' &&
        raw !== null &&
        (raw as { type?: unknown }).type === 'webview-ready'
      ) {
        this.webviewReady = true
        if (this.pendingNavigation) {
          this.panel?.webview.postMessage(this.pendingNavigation)
          this.pendingNavigation = undefined
        }
      }
    })

    this.panel.webview.html = this.buildHtml(this.panel.webview)

    this.panel.onDidDispose(() => {
      routerDisposable.dispose()
      readyDisposable.dispose()
      this.panel = undefined
      this.webviewReady = false
      this.pendingNavigation = undefined
    }, null, this.context.subscriptions)
  }

  /** Open the designer (creating the panel if needed) and navigate to a file route. */
  navigateTo(message: WebviewNavigationMessage): void {
    this.openOrReveal()
    if (!this.panel) return
    if (this.webviewReady) {
      this.panel.webview.postMessage(message)
    } else {
      // Queue until the webview announces it is ready.
      this.pendingNavigation = message
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

    html = html.replace(
      /((?:src|href)=")(\/?assets\/[^"]+)(")/g,
      (_match, prefix, assetPath, suffix) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(webviewDistPath, assetPath.replace(/^\//, '')),
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
