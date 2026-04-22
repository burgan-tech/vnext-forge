import * as vscode from 'vscode';

import { ERROR_CODES, VnextForgeError, type ApiResponse } from '@vnext-forge/app-contracts';
import {
  dispatchMethod,
  type LoggerAdapter,
  type MethodRegistry,
  type ServiceRegistry,
} from '@vnext-forge/services-core';
import type { LspBridge } from '@vnext-forge/lsp-core';

import {
  createWebviewLspTransport,
  type WebviewLspTransport,
} from './panels/lsp-transport.js';

// ── Message protocol ──────────────────────────────────────────────────────────

/** Webview → Extension Host (API call) */
export interface WebviewApiRequest {
  requestId: string;
  type: 'api';
  method: string;
  params: unknown;
}

/** Extension Host → Webview (API response) */
export interface WebviewApiResponse {
  requestId: string;
  result: ApiResponse<unknown>;
}

/** Webview ↔ Extension Host LSP tunnel frame. */
interface WebviewLspFrame {
  type: 'lsp';
  event: 'connect' | 'message' | 'disconnect';
  sessionId: string;
  data?: string;
}

/** Webview → Extension Host: surface a native VS Code notification. */
interface WebviewNotifyFrame {
  type: 'host:notify';
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
  actionLabel?: string;
  actionId?: string;
}

/** Extension Host → Webview: action button on a `host:notify` was pressed. */
interface WebviewNotifyActionReply {
  type: 'host:notify:action';
  actionId: string;
}

/** Webview → Extension Host: tunnel a designer-ui logger entry. */
interface WebviewLogFrame {
  type: 'host:log';
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  payload?: unknown;
  timestamp: string;
}

// ── Router ────────────────────────────────────────────────────────────────────

export interface MessageRouterDeps {
  registry: MethodRegistry;
  services: ServiceRegistry;
  lspBridge: LspBridge;
  logger: LoggerAdapter;
  /**
   * VS Code OutputChannel used to surface webview logs (every `host:log`
   * frame the webview sends through `createVsCodeLogSink`). Created and
   * disposed by extension activation; the router only writes to it.
   */
  webviewLogChannel: vscode.OutputChannel;
}

/**
 * Thin router that bridges a VS Code webview to:
 *   1) the shared `services-core` `methodRegistry` (API calls), and
 *   2) the shared `lsp-core` bridge (LSP over `postMessage`).
 *
 * All business logic lives in the shared packages; this class only owns the
 * VS Code-specific `postMessage` plumbing and transport lifetime.
 */
export class MessageRouter {
  private readonly activeLspTransports = new Map<string, WebviewLspTransport>();
  /** Her LSP `sessionId` hangi webview paneline ait — panel kapanınca yalnızca o oturumlar kapanır. */
  private readonly lspSessionOwner = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly deps: MessageRouterDeps) {}

  /** Attach the router to a webview panel. Returns a disposable. */
  attach(panel: vscode.WebviewPanel): vscode.Disposable {
    const messageDisposable = panel.webview.onDidReceiveMessage((raw: unknown) => {
      void this.handleIncoming(panel, raw);
    });

    const disposeDisposable = panel.onDidDispose(() => {
      this.tearDownLspSessionsForPanel(panel);
    });

    return vscode.Disposable.from(messageDisposable, disposeDisposable);
  }

  // ── API dispatch ──────────────────────────────────────────────────────────

  private async handleIncoming(panel: vscode.WebviewPanel, raw: unknown): Promise<void> {
    if (isApiRequest(raw)) {
      const response: WebviewApiResponse = {
        requestId: raw.requestId,
        result: await this.dispatchApi(raw.method, raw.params, raw.requestId),
      };
      void panel.webview.postMessage(response);
      return;
    }

    if (isLspFrame(raw)) {
      this.handleLspFrame(panel, raw);
      return;
    }

    if (isNotifyFrame(raw)) {
      void this.handleNotifyFrame(panel, raw);
      return;
    }

    if (isLogFrame(raw)) {
      this.handleLogFrame(raw);
      return;
    }
  }

  // ── Webview log tunnel ────────────────────────────────────────────────────

  private handleLogFrame(frame: WebviewLogFrame): void {
    const level = frame.level.toUpperCase();
    const head = `[${frame.timestamp}] [${level}] [${frame.scope}] ${frame.message}`;

    if (frame.payload === undefined) {
      this.deps.webviewLogChannel.appendLine(head);
      return;
    }

    let payloadText: string;
    try {
      payloadText = JSON.stringify(frame.payload);
    } catch {
      payloadText = String(frame.payload);
    }
    this.deps.webviewLogChannel.appendLine(`${head} ${payloadText}`);
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  private async handleNotifyFrame(
    panel: vscode.WebviewPanel,
    frame: WebviewNotifyFrame,
  ): Promise<void> {
    const items: string[] = frame.actionLabel ? [frame.actionLabel] : [];
    let pick: string | undefined;
    try {
      switch (frame.kind) {
        case 'error':
          pick = await vscode.window.showErrorMessage(frame.message, ...items);
          break;
        case 'warning':
          pick = await vscode.window.showWarningMessage(frame.message, ...items);
          break;
        case 'success':
        case 'info':
        default:
          pick = await vscode.window.showInformationMessage(frame.message, ...items);
          break;
      }
    } catch (error) {
      this.deps.logger.error(
        { err: error, kind: frame.kind } as Record<string, unknown>,
        'Failed to surface webview notification',
      );
      return;
    }

    if (frame.actionId && frame.actionLabel && pick === frame.actionLabel) {
      const reply: WebviewNotifyActionReply = {
        type: 'host:notify:action',
        actionId: frame.actionId,
      };
      void panel.webview.postMessage(reply);
    }
  }

  private async dispatchApi(
    method: string,
    params: unknown,
    traceId: string,
  ): Promise<ApiResponse<unknown>> {
    try {
      const data = await dispatchMethod(
        this.deps.registry,
        this.deps.services,
        method,
        params ?? {},
        // The VS Code extension host is intrinsically trusted: every
        // caller is either the user's own webview or another extension
        // the editor has already activated. We bypass the capability
        // gate with `trusted: true`.
        { traceId, caller: { trusted: true } },
      );
      return { success: true, data, error: null };
    } catch (error) {
      const forge = toVnextForgeError(error, method, traceId);
      this.deps.logger.error(
        { ...forge.toLogEntry() } as Record<string, unknown>,
        'Extension RPC handler error',
      );
      const userMessage = forge.toUserMessage();
      return {
        success: false,
        data: null,
        error: {
          code: userMessage.code,
          message: userMessage.message,
          traceId: forge.traceId ?? traceId,
        },
      };
    }
  }

  // ── LSP tunnel ────────────────────────────────────────────────────────────

  private handleLspFrame(panel: vscode.WebviewPanel, frame: WebviewLspFrame): void {
    switch (frame.event) {
      case 'connect':
        this.openLspSession(panel, frame.sessionId);
        return;
      case 'message': {
        const transport = this.activeLspTransports.get(frame.sessionId);
        if (transport && typeof frame.data === 'string') {
          transport.deliverMessage(frame.data);
        }
        return;
      }
      case 'disconnect':
        this.closeLspSession(frame.sessionId);
        return;
    }
  }

  private openLspSession(panel: vscode.WebviewPanel, sessionId: string): void {
    if (this.activeLspTransports.has(sessionId)) return;

    const transport = createWebviewLspTransport(panel, sessionId);
    this.activeLspTransports.set(sessionId, transport);
    this.lspSessionOwner.set(sessionId, panel);

    void this.deps.lspBridge.connect(sessionId, transport).catch((err) => {
      this.deps.logger.error({ err, sessionId }, 'LSP bridge connect failed');
      this.activeLspTransports.delete(sessionId);
      this.lspSessionOwner.delete(sessionId);
      transport.close(1011, 'LSP bridge unavailable');
    });
  }

  private closeLspSession(sessionId: string): void {
    const transport = this.activeLspTransports.get(sessionId);
    if (!transport) return;
    this.activeLspTransports.delete(sessionId);
    this.lspSessionOwner.delete(sessionId);
    transport.deliverClose();
  }

  private tearDownLspSessionsForPanel(panel: vscode.WebviewPanel): void {
    const sessionIds = [...this.lspSessionOwner.entries()]
      .filter(([, owner]) => owner === panel)
      .map(([id]) => id);
    for (const sessionId of sessionIds) {
      this.closeLspSession(sessionId);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isApiRequest(value: unknown): value is WebviewApiRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: unknown }).type === 'api' &&
    typeof (value as { requestId?: unknown }).requestId === 'string' &&
    typeof (value as { method?: unknown }).method === 'string'
  );
}

function isLspFrame(value: unknown): value is WebviewLspFrame {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === 'lsp' &&
    typeof v.sessionId === 'string' &&
    (v.event === 'connect' || v.event === 'message' || v.event === 'disconnect')
  );
}

function isNotifyFrame(value: unknown): value is WebviewNotifyFrame {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== 'host:notify') return false;
  if (typeof v.message !== 'string') return false;
  return (
    v.kind === 'info' || v.kind === 'success' || v.kind === 'warning' || v.kind === 'error'
  );
}

function isLogFrame(value: unknown): value is WebviewLogFrame {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== 'host:log') return false;
  if (typeof v.scope !== 'string' || typeof v.message !== 'string') return false;
  if (typeof v.timestamp !== 'string') return false;
  return v.level === 'debug' || v.level === 'info' || v.level === 'warn' || v.level === 'error';
}

function toVnextForgeError(error: unknown, method: string, traceId: string): VnextForgeError {
  if (error instanceof VnextForgeError) return error;
  return new VnextForgeError(
    ERROR_CODES.INTERNAL_UNEXPECTED,
    error instanceof Error ? error.message : 'Unexpected error',
    { source: `MessageRouter.dispatch[${method}]`, layer: 'presentation' },
    traceId,
  );
}
