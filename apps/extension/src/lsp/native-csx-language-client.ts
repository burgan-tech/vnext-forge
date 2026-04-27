import { randomUUID } from 'node:crypto';

import * as vscode from 'vscode';
import {
  LanguageClient,
  RevealOutputChannelOn,
  type LanguageClientOptions,
  type ServerOptions,
} from 'vscode-languageclient/node';

import type { LspBridge } from '@vnext-forge/lsp-core';
import type { LoggerAdapter } from '@vnext-forge/services-core';

import type { VnextWorkspaceDetector } from '../workspace-detector.js';
import {
  createNativeBridgeTransport,
  type NativeBridgeTransport,
} from './native-bridge-transport.js';

const NATIVE_ENABLE_KEY = 'lsp.enableNativeEditor';

export interface CreateNativeCsxLanguageClientDeps {
  lspBridge: LspBridge;
  workspaceDetector: VnextWorkspaceDetector;
  logger: LoggerAdapter;
  outputChannel: vscode.OutputChannel;
}

interface ActiveSession {
  client: LanguageClient;
  transport: NativeBridgeTransport;
  sessionId: string;
}

/**
 * Wires the shared `LspBridge` into a native VS Code `LanguageClient` so that
 * `.csx` files opened in the workbench TextEditor receive C# IntelliSense
 * (completion, hover, signature help) and Roslyn diagnostics in the Problems
 * panel.
 *
 * Lifecycle:
 *   - Active only while the workspace contains at least one
 *     `vnext.config.json` (driven by `VnextWorkspaceDetector.onDidChange`).
 *   - Honours the `vnextForge.lsp.enableNativeEditor` setting (default true)
 *     and reconciles on configuration change.
 *   - Document selector is narrowed to the `.csx` glob so this client never
 *     competes with `ms-dotnettools.csharp` on regular `.cs` files.
 *
 * The client multiplexes through `LspBridge.connect` with a fresh `sessionId`
 * per start; that is the same code path the Monaco webview uses, so URI
 * translation, CSX wrapping and diagnostic line shifts are reused.
 */
export function createNativeCsxLanguageClient(
  deps: CreateNativeCsxLanguageClientDeps,
): vscode.Disposable {
  const { lspBridge, workspaceDetector, logger, outputChannel } = deps;

  let active: ActiveSession | null = null;
  let pending: Promise<void> = Promise.resolve();
  let installFailureNotified = false;
  let disposed = false;

  function isEnabledInSettings(): boolean {
    const config = vscode.workspace.getConfiguration('vnextForge');
    return config.get<boolean>(NATIVE_ENABLE_KEY, true);
  }

  function shouldRun(): boolean {
    if (disposed) return false;
    if (!isEnabledInSettings()) return false;
    return workspaceDetector.getRoots().length > 0;
  }

  async function start(): Promise<void> {
    if (active || disposed) return;

    const sessionId = randomUUID();
    const transport = createNativeBridgeTransport();

    try {
      await lspBridge.connect(sessionId, transport.lspTransport);
    } catch (error) {
      transport.dispose();
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        { sessionId, message },
        'native csx LSP bridge.connect failed — skipping native client start',
      );
      notifyInstallFailureOnce(message);
      return;
    }

    const serverOptions: ServerOptions = () => Promise.resolve(transport.messageTransports);

    const clientOptions: LanguageClientOptions = {
      // Pattern-only selector: VS Code attaches the client to any file whose
      // path matches `**/*.csx`, regardless of which language id another
      // extension (e.g. ms-dotnettools.csharp) may have assigned to it.
      documentSelector: [{ scheme: 'file', pattern: '**/*.csx' }],
      synchronize: {
        configurationSection: 'vnextForge.lsp',
      },
      outputChannel,
      revealOutputChannelOn: RevealOutputChannelOn.Error,
    };

    const client = new LanguageClient(
      'vnextForge.csxNative',
      'vnext-forge C# Script (.csx)',
      serverOptions,
      clientOptions,
    );

    try {
      await client.start();
      active = { client, transport, sessionId };
      logger.info({ sessionId }, 'native csx LC started');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ sessionId, message }, 'native csx LC start failed');
      try {
        await client.stop();
      } catch {
        /* ignore */
      }
      transport.dispose();
      await safeDisconnect(sessionId);
      notifyInstallFailureOnce(message);
    }
  }

  async function stop(): Promise<void> {
    const current = active;
    if (!current) return;
    active = null;
    logger.info({ sessionId: current.sessionId }, 'native csx LC stopping');
    try {
      await current.client.stop();
    } catch (error) {
      logger.warn(
        {
          sessionId: current.sessionId,
          message: error instanceof Error ? error.message : String(error),
        },
        'native csx LC stop raised',
      );
    }
    current.transport.dispose();
    await safeDisconnect(current.sessionId);
  }

  async function safeDisconnect(sessionId: string): Promise<void> {
    try {
      await lspBridge.disconnect(sessionId);
    } catch (error) {
      logger.warn(
        {
          sessionId,
          message: error instanceof Error ? error.message : String(error),
        },
        'native csx LSP bridge.disconnect raised',
      );
    }
  }

  function notifyInstallFailureOnce(detail: string): void {
    if (installFailureNotified) return;
    installFailureNotified = true;
    void vscode.window.showInformationMessage(
      'vnext-forge: .csx IntelliSense is unavailable. Install .NET SDK / csharp-ls or check the "vnext-forge: csx Native LSP" output channel for details.',
    );
    logger.info({ detail }, 'native csx install/start failure surfaced to user');
  }

  function reconcile(): void {
    pending = pending
      .then(async () => {
        if (disposed) {
          await stop();
          return;
        }
        const want = shouldRun();
        if (want && !active) {
          await start();
        } else if (!want && active) {
          await stop();
        }
      })
      .catch((error) => {
        logger.warn(
          { message: error instanceof Error ? error.message : String(error) },
          'native csx LC reconcile error',
        );
      });
  }

  const subscriptions: vscode.Disposable[] = [];

  subscriptions.push(workspaceDetector.onDidChange(() => reconcile()));
  subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`vnextForge.${NATIVE_ENABLE_KEY}`)) {
        reconcile();
      }
    }),
  );

  reconcile();

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const sub of subscriptions) {
        try {
          sub.dispose();
        } catch {
          /* ignore */
        }
      }
      reconcile();
    },
  };
}
