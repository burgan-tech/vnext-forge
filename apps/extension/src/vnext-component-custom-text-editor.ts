import * as vscode from 'vscode'
import type { ProjectService } from '@vnext-forge-studio/services-core'

import { isDesignerEditorRoute } from './designer-helpers.js'
import { resolveFileRoute } from './file-router.js'
import type { DesignerPanel } from './panels/DesignerPanel.js'
import { baseLogger } from './shared/logger.js'
import { readVnextConfigStatusSyncCached } from './sync-vnext-config-read.js'
import type { VnextWorkspaceDetector } from './workspace-detector.js'

/**
 * The viewType registered under `contributes.customEditors` in
 * `package.json`. Must match exactly — VS Code uses it both for routing
 * file opens and for the `Reopen Editor With…` quick pick label.
 */
export const VNEXT_COMPONENT_EDITOR_VIEW_TYPE = 'vnextForge.componentEditor'

interface ProviderDeps {
  detector: VnextWorkspaceDetector
  designerPanel: DesignerPanel
  projectService: ProjectService
}

/**
 * Custom text editor provider that hijacks `*.json` opens inside vnext
 * workspaces so that bileşen JSON dosyaları ve `vnext.config.json` doğrudan
 * tasarımcı webview'inde açılır — kullanıcı önce metin editörünü görmez.
 * Bileşen olmayan JSON'lar (örn. `package.json`, `tsconfig.json`) algılanır
 * algılanmaz VS Code'un yerleşik metin editörüne devredilir.
 *
 * Loading durumu için `DesignerPanel.buildHtml`, React mount olana kadar
 * gösterilen bir boot spinner'ı inject eder; böylece kullanıcı boş bir
 * webview yerine "yükleniyor" göstergesi görür.
 */
export class VnextComponentCustomTextEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly detector: VnextWorkspaceDetector
  private readonly designerPanel: DesignerPanel
  private readonly projectService: ProjectService

  constructor(deps: ProviderDeps) {
    this.detector = deps.detector
    this.designerPanel = deps.designerPanel
    this.projectService = deps.projectService
  }

  static register(
    context: vscode.ExtensionContext,
    deps: ProviderDeps,
  ): vscode.Disposable {
    const provider = new VnextComponentCustomTextEditorProvider(deps)
    const registration = vscode.window.registerCustomEditorProvider(
      VNEXT_COMPONENT_EDITOR_VIEW_TYPE,
      provider,
      {
        // Background tabs keep their React tree alive so switching back
        // is instant — matches the standalone DesignerPanel behaviour.
        webviewOptions: { retainContextWhenHidden: true },
        // Without this VS Code allocates one provider instance per
        // resource; we want a single shared instance backed by the
        // shared `DesignerPanel` so the editor store stays consistent.
        supportsMultipleEditorsPerDocument: false,
      },
    )
    context.subscriptions.push(registration)
    return registration
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const uri = document.uri

    try {
      await this.resolveCustomTextEditorSafe(document, webviewPanel)
    } catch (error) {
      baseLogger.warn(
        {
          path: uri.fsPath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to resolve vnext component custom editor; falling back to text editor',
      )
      await this.openInTextEditor(uri, webviewPanel)
    }
  }

  private async resolveCustomTextEditorSafe(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    const uri = document.uri

    // Git diff and Timeline resolve both sides (git: original + file:
    // modified) through our custom editor. Rendering the designer in
    // either side breaks the diff composite, so detect the diff context
    // first and render raw document text instead. This check must come
    // before the scheme guard so both sides are handled uniformly.
    if (isInDiffContext(uri)) {
      baseLogger.debug({ path: uri.fsPath }, 'Diff context detected — bypassing designer')
      renderDocumentAsPlainText(document, webviewPanel)
      return
    }

    // Non-file schemes outside a diff context (e.g. untitled:) are not
    // candidates for the designer. Fall back to the text editor.
    if (uri.scheme !== 'file') {
      await this.openInTextEditor(uri, webviewPanel)
      return
    }

    const target = uri.fsPath
    const root = this.detector.findOwningRoot(target)
    if (!root) {
      await this.openInTextEditor(uri, webviewPanel)
      return
    }

    const status = readVnextConfigStatusSyncCached(root.folderPath)
    if (status.status !== 'ok') {
      await this.openInTextEditor(uri, webviewPanel)
      return
    }

    const route = resolveFileRoute(target, status.config, root.folderPath)
    if (!isDesignerEditorRoute(route)) {
      await this.openInTextEditor(uri, webviewPanel)
      return
    }

    this.designerPanel.adoptWebviewPanel(webviewPanel, {
      type: 'open-editor',
      kind: route.kind,
      projectId: status.config.domain,
      projectPath: root.folderPath,
      projectDomain: status.config.domain,
      group: route.group,
      name: route.name,
      filePath: route.filePath,
      vnextConfig: status.config,
    })

    promoteOutOfPreviewMode(webviewPanel)

    // Project registry hydration is best-effort — failures only mean the
    // designer's project store may need to refresh later.
    void this.projectService.importProject(root.folderPath).catch((error) => {
      baseLogger.warn(
        { folder: root.folderPath, error: (error as Error).message },
        'importProject after custom-editor open failed',
      )
    })
  }

  /**
   * VS Code allocated a webview for us but the file isn't a designer
   * candidate. Hand the user back to the regular text editor and dismiss
   * the webview tab. We deliberately use `viewType: 'default'` so VS Code
   * doesn't loop back into our provider.
   */
  private async openInTextEditor(
    uri: vscode.Uri,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    // Render NOTHING in the soon-to-be-disposed webview so the user
    // doesn't see a flash of designer chrome on the way to the text
    // editor. CSP-strict empty document is fine.
    try {
      webviewPanel.webview.html =
        '<!doctype html><meta charset="utf-8" /><title>vnext-forge-studio</title>'
    } catch {
      /* ignore */
    }

    let openedInTextEditor = false
    try {
      const viewColumn = getConcreteViewColumn(webviewPanel)
      if (viewColumn === undefined) {
        await vscode.commands.executeCommand('vscode.openWith', uri, 'default')
      } else {
        await vscode.commands.executeCommand('vscode.openWith', uri, 'default', viewColumn)
      }
      openedInTextEditor = true
    } catch (openWithError) {
      baseLogger.warn(
        {
          path: uri.fsPath,
          error: openWithError instanceof Error ? openWithError.message : String(openWithError),
        },
        'Failed to redirect non-component JSON to the text editor',
      )

      try {
        const document = await vscode.workspace.openTextDocument(uri)
        const viewColumn = getConcreteViewColumn(webviewPanel)
        if (viewColumn === undefined) {
          await vscode.window.showTextDocument(document, { preview: false })
        } else {
          await vscode.window.showTextDocument(document, { preview: false, viewColumn })
        }
        openedInTextEditor = true
      } catch (fallbackError) {
        baseLogger.warn(
          {
            path: uri.fsPath,
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          },
          'Fallback openTextDocument failed for non-component JSON',
        )
        void vscode.window.showWarningMessage(
          'vnext-forge-studio: Could not open this file in the text editor. See the vnext-forge-studio-core output for details.',
        )
      }
    } finally {
      if (openedInTextEditor) {
        try {
          webviewPanel.dispose()
        } catch {
          /* ignore */
        }
      }
    }
  }
}

/**
 * Renders the document's text content as read-only plain text inside the
 * webview panel. Used in diff contexts where the designer must not load
 * but the webview panel cannot be disposed (disposing would break VS
 * Code's diff composite). Updates when the document changes so the diff
 * stays accurate.
 */
function renderDocumentAsPlainText(
  document: vscode.TextDocument,
  webviewPanel: vscode.WebviewPanel,
): void {
  const setHtml = (): void => {
    const text = escapeHtml(document.getText())
    webviewPanel.webview.html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline';" />
<style>
  body {
    margin: 0;
    padding: 8px 12px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    line-height: var(--vscode-editor-line-height, 1.5);
    color: var(--vscode-editor-foreground);
    background: var(--vscode-editor-background);
    white-space: pre;
    overflow: auto;
    tab-size: 2;
  }
</style>
</head>
<body>${text}</body>
</html>`
  }

  setHtml()

  const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.document.uri.toString() === document.uri.toString()) {
      setHtml()
    }
  })
  webviewPanel.onDidDispose(() => onChange.dispose())
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Checks whether the given URI is being opened as part of a diff view
 * (Git diff, Timeline, etc.). VS Code's Tab API exposes
 * `TabInputTextDiff` for side-by-side text diffs — if we find a tab
 * whose original or modified URI matches, the user clicked through a
 * diff context and we should NOT hijack the editor with the designer.
 */
function isInDiffContext(uri: vscode.Uri): boolean {
  const uriString = uri.toString()
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputTextDiff) {
        if (
          tab.input.original.toString() === uriString ||
          tab.input.modified.toString() === uriString
        ) {
          return true
        }
      }
    }
  }
  return false
}

function getConcreteViewColumn(panel: vscode.WebviewPanel): vscode.ViewColumn | undefined {
  const viewColumn = panel.viewColumn
  if (typeof viewColumn !== 'number' || viewColumn < vscode.ViewColumn.One) {
    return undefined
  }
  return viewColumn
}

/**
 * VS Code'un Explorer'da tek tıklama davranışı: dosya bir
 * **preview** tab'ında açılır (başlık italik) ve başka bir dosyaya
 * tıklanınca aynı tab'ı ele geçirir — yani her dosya için yeni bir tab
 * AÇILMAZ. Bu davranış metin dosyaları için bile aynı olduğundan,
 * varsayılan VS Code ayarına saygılı olmak isterdik; ancak vnext-forge-studio
 * tasarımcısının tab başına ağır bir webview booting maliyeti var
 * (loading ekranı, React mount, store hydration) ve preview tab'ının
 * silinmesi bu maliyeti boşa harcatıyor.
 *
 * Çözüm: tab açıldığı anda `workbench.action.keepEditor` komutu
 * aracılığıyla persistent tab'a yükseltiyoruz. Bu komut, aktif
 * editor'a etki ettiği için ilk render frame'inde planlıyoruz —
 * `resolveCustomTextEditor` çağrıldığında VS Code newly-opened
 * tab'ı zaten aktif yapmış oluyor.
 *
 * Tab başlık italikliği bu çağrıdan sonra anında kaybolur ve sonraki
 * dosya tıklamaları yeni preview tab'ları açar (sırayla onlar da
 * persistent'a yükseltilir).
 */
function promoteOutOfPreviewMode(panel: vscode.WebviewPanel): void {
  // İlk frame'de promotion'ı planla; webview adoption tamamen yerleşsin.
  // Çoklu çağrı güvenli (`keepEditor` zaten persistent tab üzerinde no-op).
  const tryPromote = (): void => {
    // Panel hidden iken `keepEditor` yanlış editor'ı pinleyebilir; sadece
    // gerçekten görünür ve bizim yeni açılan tab'ımız aktif iken çalıştır.
    if (!panel.active && !panel.visible) return
    void vscode.commands.executeCommand('workbench.action.keepEditor').then(
      () => undefined,
      (error: unknown) => {
        baseLogger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'workbench.action.keepEditor failed for vnext component editor',
        )
      },
    )
  }

  // Mikro-tick (komut dispatch sıraya gir) + bir RAF benzeri gecikme
  // (VS Code internal tab state senkronize olsun). Bu iki adım,
  // soğuk açılışlarda da güvenilir promotion sağlar.
  queueMicrotask(tryPromote)
  setTimeout(tryPromote, 16)
}
