/**
 * Lightweight Roslyn LSP client for Monaco Editor.
 *
 * Connects to the BFF WebSocket bridge at /api/lsp/csharp and translates
 * LSP protocol messages into native Monaco language provider registrations:
 *   - textDocument/completion      → registerCompletionItemProvider
 *   - textDocument/hover           → registerHoverProvider
 *   - textDocument/signatureHelp   → registerSignatureHelpProvider
 *   - textDocument/publishDiagnostics → editor.setModelMarkers
 *
 * Uses raw WebSocket + JSON-RPC — no external library dependency.
 */
import type { Monaco } from '@monaco-editor/react';
import { createLogger } from '../../../lib/logger/createLogger';
import { getHostEditorCapabilities } from '../../../lsp/hostEditorCapabilitiesRegistry.js';
import { isMessageOriginAllowed } from '../../../lib/messageOriginPolicy.js';

const logger = createLogger('RoslynLspClient');

// ── JSON-RPC types ─────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return 'id' in msg && !('method' in msg);
}

// ── LSP Position / Range helpers ──────────────────────────────────────────────

function monacoPositionToLsp(position: any) {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}

function lspRangeToMonaco(range: any) {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

function lspSeverityToMonaco(severity: number, monaco: Monaco): number {
  // LSP: 1=Error, 2=Warning, 3=Information, 4=Hint
  switch (severity) {
    case 1: return monaco.MarkerSeverity.Error;
    case 2: return monaco.MarkerSeverity.Warning;
    case 3: return monaco.MarkerSeverity.Info;
    default: return monaco.MarkerSeverity.Hint;
  }
}

function lspCompletionKindToMonaco(kind: number | undefined, monaco: Monaco): number {
  // LSP CompletionItemKind → Monaco CompletionItemKind
  const map: Record<number, number> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    22: monaco.languages.CompletionItemKind.EnumMember,
    23: monaco.languages.CompletionItemKind.Constant,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };
  return map[kind ?? 0] ?? monaco.languages.CompletionItemKind.Text;
}

// ── WS URL (standalone web app only) ─────────────────────────────────────────

function getWsUrl(sessionId: string): string {
  const baseUrl = getHostEditorCapabilities().lspWebSocketBaseUrl;
  // When the host injected an explicit API origin (e.g. apps/web in dev mode
  // talking to apps/server on :3001), use that. Otherwise fall back to the
  // page's own origin (production same-origin deployments).
  if (baseUrl) {
    const url = new URL(baseUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/api/lsp/csharp?session=${encodeURIComponent(sessionId)}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/lsp/csharp?session=${encodeURIComponent(sessionId)}`;
}

// ── LSP Client ────────────────────────────────────────────────────────────────

export interface CsharpLspClient {
  start(): Promise<void>;
  dispose(): void;
}

/**
 * Creates a lightweight Roslyn LSP client for the given editor instance.
 *
 * @param monaco - The Monaco API instance
 * @param sessionId - Unique session identifier (used for the WS ?session= param)
 */
export function createCsharpLspClient(monaco: Monaco, sessionId: string): CsharpLspClient {
  let nextId = 1;
  let disposed = false;
  // Abstracted transport: set by startWithWebSocket or startWithPostMessage
  let connected = false;
  let doSend: (rawJson: string) => void = () => { /* not yet connected */ };
  let doDisconnect: () => void = () => { /* not yet connected */ };

  const pendingRequests = new Map<number, { resolve: (r: unknown) => void; reject: (e: unknown) => void }>();
  const disposables: Array<{ dispose(): void }> = [];

  // ── JSON-RPC helpers ─────────────────────────────────────────────────────

  function sendRaw(json: string): void {
    if (!connected) return;
    doSend(json);
  }

  function sendNotification(method: string, params?: unknown): void {
    if (!connected) return;
    const msg: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    doSend(JSON.stringify(msg));
  }

  function sendRequest(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!connected) {
        reject(new Error('LSP transport not connected'));
        return;
      }
      const id = nextId++;
      pendingRequests.set(id, { resolve, reject });
      const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      doSend(JSON.stringify(msg));
    });
  }

  // ── LSP Initialize ───────────────────────────────────────────────────────

  async function initialize(): Promise<void> {
    await sendRequest('initialize', {
      processId: null,
      clientInfo: { name: 'vnext-forge-studio', version: '1.0.0' },
      rootUri: null,
      capabilities: {
        textDocument: {
          synchronization: { didSave: false, willSave: false },
          completion: {
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          signatureHelp: {
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
              parameterInformation: { labelOffsetSupport: true },
            },
          },
          publishDiagnostics: { relatedInformation: false },
        },
      },
    });
    sendNotification('initialized', {});
    logger.info('Roslyn LSP initialized', { sessionId });
  }

  // ── Monaco provider registration ─────────────────────────────────────────

  /**
   * Wrap an LSP request with Monaco's CancellationToken so the provider does
   * not hold its async result open after the user has moved on (typed another
   * character, dismissed the suggest widget, …). Without this, every
   * in-flight `textDocument/completion` keeps the suggest widget in a
   * loading state and the next keystroke (e.g. plain space) ends up queued
   * behind the stale request.
   */
  function sendCancellableRequest(
    method: string,
    params: unknown,
    token: { isCancellationRequested: boolean; onCancellationRequested(cb: () => void): { dispose(): void } } | undefined,
  ): Promise<unknown> {
    if (token?.isCancellationRequested) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      let settled = false;
      const cancelSub = token?.onCancellationRequested(() => {
        if (settled) return;
        settled = true;
        resolve(null);
      });
      sendRequest(method, params).then(
        (result) => {
          if (settled) return;
          settled = true;
          cancelSub?.dispose();
          resolve(result);
        },
        (err) => {
          if (settled) return;
          settled = true;
          cancelSub?.dispose();
          reject(err);
        },
      );
    });
  }

  function registerProviders(): void {
    // ── Completions ──────────────────────────────────────────────────────
    // Trigger characters: `.` for member access, `(` for method invocation.
    // Space is intentionally NOT a trigger — registering it forces an LSP
    // round-trip on every space keystroke, which makes typing feel frozen
    // because Monaco's suggest widget waits for the response before
    // committing the keystroke.
    disposables.push(
      monaco.languages.registerCompletionItemProvider('csharp', {
        triggerCharacters: ['.', '('],
        async provideCompletionItems(model: any, position: any, _context: any, token: any) {
          try {
            const result = await sendCancellableRequest('textDocument/completion', {
              textDocument: { uri: model.uri.toString() },
              position: monacoPositionToLsp(position),
            }, token) as any;

            if (token?.isCancellationRequested) return { suggestions: [] };
            if (!result) return { suggestions: [] };

            const items: any[] = Array.isArray(result) ? result : result.items ?? [];
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            return {
              suggestions: items.map((item: any) => ({
                label: typeof item.label === 'string' ? item.label : item.label?.label ?? '',
                kind: lspCompletionKindToMonaco(item.kind, monaco),
                detail: item.detail ?? '',
                documentation: item.documentation
                  ? typeof item.documentation === 'string'
                    ? item.documentation
                    : { value: item.documentation.value ?? '', isTrusted: false }
                  : undefined,
                insertText: item.textEdit?.newText ?? item.insertText ?? item.label,
                insertTextRules: item.insertTextFormat === 2
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
                range,
              })),
            };
          } catch {
            return { suggestions: [] };
          }
        },
      }),
    );

    // ── Hover ────────────────────────────────────────────────────────────
    disposables.push(
      monaco.languages.registerHoverProvider('csharp', {
        async provideHover(model: any, position: any, token: any) {
          try {
            const result = await sendCancellableRequest('textDocument/hover', {
              textDocument: { uri: model.uri.toString() },
              position: monacoPositionToLsp(position),
            }, token) as any;

            if (token?.isCancellationRequested) return null;
            if (!result?.contents) return null;

            const contents = Array.isArray(result.contents)
              ? result.contents
              : [result.contents];

            return {
              contents: contents.map((c: any) => ({
                value: typeof c === 'string' ? c : c.value ?? '',
                isTrusted: false,
              })),
              range: result.range ? lspRangeToMonaco(result.range) : undefined,
            };
          } catch {
            return null;
          }
        },
      }),
    );

    // ── Signature Help ───────────────────────────────────────────────────
    disposables.push(
      monaco.languages.registerSignatureHelpProvider('csharp', {
        signatureHelpTriggerCharacters: ['(', ','],
        async provideSignatureHelp(model: any, position: any, token: any) {
          try {
            const result = await sendCancellableRequest('textDocument/signatureHelp', {
              textDocument: { uri: model.uri.toString() },
              position: monacoPositionToLsp(position),
            }, token) as any;

            if (token?.isCancellationRequested) return null;
            if (!result?.signatures?.length) return null;

            return {
              value: {
                signatures: result.signatures.map((sig: any) => ({
                  label: sig.label ?? '',
                  documentation: sig.documentation
                    ? { value: typeof sig.documentation === 'string' ? sig.documentation : sig.documentation.value ?? '' }
                    : undefined,
                  parameters: (sig.parameters ?? []).map((p: any) => ({
                    label: p.label ?? '',
                    documentation: p.documentation
                      ? { value: typeof p.documentation === 'string' ? p.documentation : p.documentation.value ?? '' }
                      : undefined,
                  })),
                })),
                activeSignature: result.activeSignature ?? 0,
                activeParameter: result.activeParameter ?? 0,
              },
              dispose: () => { /* noop */ },
            };
          } catch {
            return null;
          }
        },
      }),
    );
  }

  // ── Document synchronization ─────────────────────────────────────────────

  function notifyDidOpen(model: any): void {
    const uri = model.uri.toString();
    logger.info('textDocument/didOpen', { uri, sessionId });
    sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: 'csharp',
        version: model.getVersionId(),
        text: model.getValue(),
      },
    });
  }

  function notifyDidChange(model: any): void {
    sendNotification('textDocument/didChange', {
      textDocument: { uri: model.uri.toString(), version: model.getVersionId() },
      contentChanges: [{ text: model.getValue() }],
    });
  }

  function notifyDidClose(model: any): void {
    sendNotification('textDocument/didClose', {
      textDocument: { uri: model.uri.toString() },
    });
  }

  // ── Diagnostics from server push ─────────────────────────────────────────

  function applyPublishDiagnostics(params: any): void {
    const { uri, diagnostics } = params;
    logger.info('publishDiagnostics received', { uri, count: (diagnostics ?? []).length, sessionId });
    // Primary lookup by exact URI (server rewrites file:// → inmemory://)
    let model = monaco.editor.getModel(monaco.Uri.parse(uri));
    // Fallback: find the active C# model (only one Script.cs per session)
    if (!model) {
      logger.warn('Model not found by URI, falling back to language search', { uri });
      model = monaco.editor.getModels().find((m: any) => m.getLanguageId() === 'csharp') ?? null;
    }
    if (!model) {
      logger.warn('No C# model found for diagnostics', { uri });
      return;
    }

    const markers = (diagnostics ?? []).map((d: any) => ({
      severity: lspSeverityToMonaco(d.severity, monaco),
      message: d.message ?? '',
      startLineNumber: (d.range?.start?.line ?? 0) + 1,
      startColumn: (d.range?.start?.character ?? 0) + 1,
      endLineNumber: (d.range?.end?.line ?? 0) + 1,
      endColumn: (d.range?.end?.character ?? 0) + 1,
      source: 'Roslyn',
    }));

    monaco.editor.setModelMarkers(model, 'roslyn-lsp', markers);
  }

  // ── Incoming message dispatch ─────────────────────────────────────────────

  function handleMessage(msg: JsonRpcMessage): void {
    if (isResponse(msg)) {
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Notification or server-initiated request
    if ('method' in msg) {
      if (msg.method === 'textDocument/publishDiagnostics') {
        applyPublishDiagnostics(msg.params as any);
        return;
      }

      // Server-initiated requests have both 'method' and 'id'.
      // csharp-ls sends client/registerCapability and workspace/configuration
      // before it starts analysing files. Without responses it hangs forever.
      if ('id' in msg) {
        const response = msg.method === 'workspace/configuration'
          // Return an empty config object per workspace folder requested
          ? { jsonrpc: '2.0' as const, id: (msg as any).id, result: ((msg as any).params?.items ?? []).map(() => ({})) }
          : { jsonrpc: '2.0' as const, id: (msg as any).id, result: null };
        sendRaw(JSON.stringify(response));
      }
      // Other notifications (window/logMessage etc.) are silently ignored
    }
  }

  // ── Model change tracking ─────────────────────────────────────────────────

  function trackModels(): void {
    const trackedModels = new Set<string>();

    function trackModel(model: any): void {
      if (model.getLanguageId() !== 'csharp') return;
      const uri = model.uri.toString();
      if (trackedModels.has(uri)) return;
      trackedModels.add(uri);
      notifyDidOpen(model);

      const changeDisposable = model.onDidChangeContent(() => {
        notifyDidChange(model);
      });
      const disposeDisposable = model.onWillDispose(() => {
        notifyDidClose(model);
        trackedModels.delete(uri);
        changeDisposable.dispose();
        disposeDisposable.dispose();
      });
    }

    // Track all currently open C# models
    monaco.editor.getModels().forEach(trackModel);

    // Track future models
    disposables.push(
      monaco.editor.onDidCreateModel((model: any) => trackModel(model)),
    );
  }

  // ── postMessage transport (VS Code webview) ──────────────────────────────

  async function startWithPostMessage(): Promise<void> {
    const caps = getHostEditorCapabilities();
    const sendToHost = caps.postMessageToHost;
    if (!sendToHost) {
      throw new Error(
        'LSP postMessage transport requested but HostEditorCapabilities.postMessageToHost is not set',
      );
    }

    const windowListener = (event: MessageEvent) => {
      if (!isMessageOriginAllowed(event.origin, caps.postMessageAllowedOrigins)) {
        logger.warn('Ignoring LSP postMessage from unexpected origin', {
          sessionId,
          origin: event.origin,
        });
        return;
      }

      const msg = event.data as { type?: string; event?: string; data?: unknown; reason?: string };
      if (msg?.type !== 'lsp') return;

      if (msg.event === 'close') {
        connected = false;
        window.removeEventListener('message', windowListener);
        logger.info('LSP postMessage transport closed', { sessionId, reason: msg.reason });
        pendingRequests.forEach(({ reject: r }) => r(new Error('LSP connection closed')));
        pendingRequests.clear();
        return;
      }

      if (msg.event === 'message' && msg.data) {
        try {
          handleMessage(msg.data as JsonRpcMessage);
        } catch { /* malformed */ }
      }
    };

    window.addEventListener('message', windowListener);

    // Wire send: each call forwards raw JSON to the extension host bridge
    doSend = (rawJson: string) => {
      sendToHost({ type: 'lsp', event: 'message', sessionId, data: rawJson });
    };

    doDisconnect = () => {
      connected = false;
      window.removeEventListener('message', windowListener);
      sendToHost({ type: 'lsp', event: 'disconnect', sessionId });
    };

    // Signal the extension host to open an LSP session
    sendToHost({ type: 'lsp', event: 'connect', sessionId });
    connected = true;

    await initialize();
    registerProviders();
    trackModels();

    logger.info('LSP postMessage transport connected', { sessionId });
  }

  // ── WebSocket transport (standalone web app) ──────────────────────────────

  function startWithWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = getWsUrl(sessionId);
      const ws = new WebSocket(url);

      ws.addEventListener('error', () => {
        reject(new Error('LSP WebSocket connection failed'));
      });

      ws.addEventListener('open', async () => {
        logger.info('LSP WebSocket connected', { sessionId });

        doSend = (rawJson: string) => ws.send(rawJson);
        doDisconnect = () => {
          connected = false;
          if (ws.readyState !== WebSocket.CLOSED) {
            try { ws.close(); } catch { /* ignore */ }
          }
        };
        connected = true;

        ws.addEventListener('message', (event) => {
          try {
            const msg = JSON.parse(event.data as string) as JsonRpcMessage;
            handleMessage(msg);
          } catch { /* malformed JSON */ }
        });

        ws.addEventListener('close', () => {
          connected = false;
          logger.info('LSP WebSocket closed', { sessionId });
          pendingRequests.forEach(({ reject: r }) => r(new Error('Connection closed')));
          pendingRequests.clear();
        });

        try {
          await initialize();
          registerProviders();
          trackModels();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // ── Public interface ──────────────────────────────────────────────────────

  return {
    start(): Promise<void> {
      return getHostEditorCapabilities().csharpLspUsesPostMessageTransport
        ? startWithPostMessage()
        : startWithWebSocket();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      for (const d of disposables) {
        try { d.dispose(); } catch { /* ignore */ }
      }
      disposables.length = 0;
      pendingRequests.forEach(({ reject: r }) => r(new Error('LSP client disposed')));
      pendingRequests.clear();

      doDisconnect();

      logger.info('Roslyn LSP client disposed', { sessionId });
    },
  };
}
