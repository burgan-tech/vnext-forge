import * as vscode from 'vscode'
import { ensureOmniSharp } from './lsp/omnisharp-installer'
import { baseLogger } from '@ext/shared/logger'

/**
 * On activation, pre-install the C# language server so the first LSP session
 * starts up instantly. Runs in the background; failures never block activation.
 */
export function bootstrapLsp(): void {
  const config = vscode.workspace.getConfiguration('vnextForge')
  const autoInstall = config.get<boolean>('lsp.autoInstall', true)
  if (!autoInstall) {
    baseLogger.info({}, 'LSP auto-install disabled by settings — skipping bootstrap')
    return
  }

  void vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Preparing vnext-forge language services',
    },
    async (progress) => {
      progress.report({ message: 'Locating C# language server…' })
      try {
        const info = await ensureOmniSharp()
        baseLogger.info(
          { server: info.serverType, path: info.executablePath },
          'LSP bootstrap completed',
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        baseLogger.warn({ message }, 'LSP bootstrap failed — lazy startup will retry on demand')
      }
    },
  )
}
