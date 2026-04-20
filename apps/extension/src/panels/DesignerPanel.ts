import * as fs from 'node:fs'
import * as vscode from 'vscode'
import type { VnextWorkspaceConfig } from '@vnext-forge/services-core'

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

export class DesignerPanel {
  private panel: vscode.WebviewPanel | undefined
  private readonly context: vscode.ExtensionContext
  private readonly router: MessageRouter
  private pendingOpen: DesignerOpenEditorMessage | undefined
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
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui'),
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
  openEditor(message: DesignerOpenEditorMessage): void {
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
      'webview-ui',
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

/**
 * Build the runtime config blob injected into the webview as
 * `window.__VNEXT_CONFIG__`. The webview communicates with the host
 * over `postMessage` (no HTTP), so we deliberately do NOT inject any
 * URL-shaped fields — older versions hardcoded `https://localhost/api`
 * here, which gave security reviewers a false signal that the webview
 * was talking to a real network endpoint.
 *
 * Only fields actively read by `packages/designer-ui/src/config/config.ts`
 * belong here. Add a new field on both sides in the same change.
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
