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
} from './webview/webview-lsp-transport.js';

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

// ── Router ────────────────────────────────────────────────────────────────────

export interface MessageRouterDeps {
  registry: MethodRegistry;
  services: ServiceRegistry;
  lspBridge: LspBridge;
  logger: LoggerAdapter;
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

  constructor(private readonly deps: MessageRouterDeps) {}

  /** Attach the router to a webview panel. Returns a disposable. */
  attach(panel: vscode.WebviewPanel): vscode.Disposable {
    const messageDisposable = panel.webview.onDidReceiveMessage((raw: unknown) => {
      void this.handleIncoming(panel, raw);
    });

    const disposeDisposable = panel.onDidDispose(() => {
      this.tearDownAllLspSessions();
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
        { traceId },
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

    void this.deps.lspBridge.connect(sessionId, transport).catch((err) => {
      this.deps.logger.error({ err, sessionId }, 'LSP bridge connect failed');
      this.activeLspTransports.delete(sessionId);
      transport.close(1011, 'LSP bridge unavailable');
    });
  }

  private closeLspSession(sessionId: string): void {
    const transport = this.activeLspTransports.get(sessionId);
    if (!transport) return;
    this.activeLspTransports.delete(sessionId);
    transport.deliverClose();
  }

  private tearDownAllLspSessions(): void {
    const ids = [...this.activeLspTransports.keys()];
    for (const sessionId of ids) {
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

function toVnextForgeError(error: unknown, method: string, traceId: string): VnextForgeError {
  if (error instanceof VnextForgeError) return error;
  return new VnextForgeError(
    ERROR_CODES.INTERNAL_UNEXPECTED,
    error instanceof Error ? error.message : 'Unexpected error',
    { source: `MessageRouter.dispatch[${method}]`, layer: 'presentation' },
    traceId,
  );
}
