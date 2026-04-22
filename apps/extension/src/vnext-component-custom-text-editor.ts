import * as vscode from 'vscode'
import type { ProjectService } from '@vnext-forge/services-core'

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
 * workspaces so that bileşen JSON dosyaları doğrudan tasarımcı webview'inde
 * açılır — kullanıcı önce metin editörünü görmez. Bileşen olmayan JSON'lar
 * (örn. `vnext.config.json`, `package.json`, `tsconfig.json`) algılanır
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

    // We only register for `*.json` selector but VS Code may still hand
    // us non-file schemes (git diff, untitled, etc.). For anything that
    // isn't a real on-disk file, fall back to the text editor.
    if (uri.scheme !== 'file') {
      await this.openInTextEditor(uri, webviewPanel)
      return
    }

    const userPrefersDesigner = vscode.workspace
      .getConfiguration('vnextForge')
      .get<boolean>('openComponentJsonInDesigner', true)

    if (!userPrefersDesigner) {
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
      // `vnext.config.json` ve tanınmayan dosyalar VS Code'un metin
      // editöründe açılır — webview burada anlamlı bir UI sunmuyor.
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
        '<!doctype html><meta charset="utf-8" /><title>vnext-forge</title>'
    } catch {
      /* ignore */
    }

    try {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        uri,
        'default',
        webviewPanel.viewColumn ?? vscode.ViewColumn.Active,
      )
    } catch (error) {
      baseLogger.warn(
        { path: uri.fsPath, error: (error as Error).message },
        'Failed to redirect non-component JSON to the text editor',
      )
    } finally {
      try {
        webviewPanel.dispose()
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * VS Code'un Explorer'da tek tıklama davranışı: dosya bir
 * **preview** tab'ında açılır (başlık italik) ve başka bir dosyaya
 * tıklanınca aynı tab'ı ele geçirir — yani her dosya için yeni bir tab
 * AÇILMAZ. Bu davranış metin dosyaları için bile aynı olduğundan,
 * varsayılan VS Code ayarına saygılı olmak isterdik; ancak vnext-forge
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
