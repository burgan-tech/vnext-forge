import { randomUUID } from 'node:crypto';

import * as vscode from 'vscode';
import {
  LanguageClient,
  RevealOutputChannelOn,
  type LanguageClientOptions,
  type ServerOptions,
} from 'vscode-languageclient/node';

import type { LspBridge } from '@vnext-forge-studio/lsp-core';
import type { LoggerAdapter } from '@vnext-forge-studio/services-core';

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

  function hasOpenCsxDocument(): boolean {
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme !== 'file') continue;
      if (doc.uri.fsPath.toLowerCase().endsWith('.csx')) return true;
    }
    return false;
  }

  function shouldRun(): boolean {
    if (disposed) return false;
    if (!isEnabledInSettings()) return false;
    if (workspaceDetector.getRoots().length === 0) return false;
    // Only spin up the analyzer when the user actually has a `.csx`
    // file open. Auto-starting on workspace activation made it look
    // like our extension was responsible for diagnostics on unrelated
    // C# files (e.g. a sibling `tests/*.csproj` project) when in fact
    // those were being reported by VS Code's own C# tooling. Lazy
    // activation also avoids spawning csharp-ls until it's needed.
    return hasOpenCsxDocument();
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
      'vnext-forge-studio C# Script (.csx)',
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
      'vnext-forge-studio: .csx IntelliSense is unavailable. Install .NET SDK / csharp-ls or check the "vnext-forge-studio: csx Native LSP" output channel for details.',
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
  // Reconcile only on `.csx` *open* — once the analyzer is up, leave
  // it running. Tearing it down on close raced with VS Code's own
  // automatic `textDocument/didClose` notification: the LanguageClient
  // queued the didClose while we called `client.stop()`, the server
  // closed the connection mid-flight, and the runtime reported
  // "Connection to server got closed. Server will not be restarted."
  // The client only fully shuts down on workspace change / setting
  // toggle / disposal — see `shouldRun()` + `reconcile()`.
  subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.uri.scheme === 'file' && doc.uri.fsPath.toLowerCase().endsWith('.csx')) {
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
