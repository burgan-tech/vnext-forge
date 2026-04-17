import * as vscode from 'vscode';

import { createOmniSharpInstaller } from '@vnext-forge/lsp-core';
import type { LoggerAdapter } from '@vnext-forge/services-core';

import { baseLogger } from './shared/logger.js';

/**
 * On activation, pre-install the C# language server so the first LSP session
 * starts up instantly. Runs in the background; failures never block activation.
 *
 * Accepts the `LoggerAdapter` from `services-core` so the installer shares the
 * same log sink (`vnext-forge-core` OutputChannel) as the rest of the shared
 * services.
 */
export function bootstrapLsp(logger: LoggerAdapter): void {
  const config = vscode.workspace.getConfiguration('vnextForge');
  const autoInstall = config.get<boolean>('lsp.autoInstall', true);
  if (!autoInstall) {
    baseLogger.info({}, 'LSP auto-install disabled by settings — skipping bootstrap');
    return;
  }

  void vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Preparing vnext-forge language services',
    },
    async (progress) => {
      progress.report({ message: 'Locating C# language server…' });
      try {
        const installer = createOmniSharpInstaller({ logger });
        const info = await installer.ensureLspServer();
        baseLogger.info(
          { server: info.serverType, path: info.executablePath },
          'LSP bootstrap completed',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        baseLogger.warn(
          { message },
          'LSP bootstrap failed — lazy startup will retry on demand',
        );
      }
    },
  );
}
