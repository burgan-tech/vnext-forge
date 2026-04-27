import {
  AbstractMessageReader,
  AbstractMessageWriter,
  type DataCallback,
  type Disposable,
  type Message,
  type MessageReader,
  type MessageTransports,
  type MessageWriter,
} from 'vscode-languageclient/node';

import type { LspClientTransport } from '@vnext-forge/lsp-core';

/**
 * Adapter that exposes a `vscode-languageclient`-compatible
 * `MessageTransports` pair on one side and a shared
 * `LspClientTransport` (used by `packages/lsp-core` `LspBridge`) on the
 * other.
 *
 * `LspBridge.connect(sessionId, lspTransport)` drives the bridge as if it
 * were talking to a webview/WebSocket client. Internally we pump JSON-RPC
 * frames between that bridge and the native VS Code `LanguageClient`:
 *
 *   bridge.send(rawJson)        ──► reader.callback(JSON.parse(rawJson))
 *   writer.write(message)       ──► onMessage(JSON.stringify(message))
 *   bridge.close(code, reason)  ──► reader.fireClose / writer.fireClose
 *   reader.dispose|writer.end() ──► onClose listeners (bridge teardown)
 *
 * The bridge already handles JSON-RPC framing in string form, so the
 * transport only needs to serialise/parse, never frame headers.
 */
export interface NativeBridgeTransport {
  readonly messageTransports: MessageTransports;
  readonly lspTransport: LspClientTransport;
  dispose(): void;
}

class BridgeMessageReader extends AbstractMessageReader implements MessageReader {
  private callback: DataCallback | undefined;

  listen(callback: DataCallback): Disposable {
    this.callback = callback;
    return {
      dispose: () => {
        if (this.callback === callback) {
          this.callback = undefined;
        }
      },
    };
  }

  push(message: Message): void {
    this.callback?.(message);
  }

  signalClose(): void {
    this.fireClose();
  }

  signalError(error: Error): void {
    this.fireError(error);
  }
}

class BridgeMessageWriter extends AbstractMessageWriter implements MessageWriter {
  constructor(private readonly forward: (message: Message) => void) {
    super();
  }

  write(msg: Message): Promise<void> {
    try {
      this.forward(msg);
      return Promise.resolve();
    } catch (error) {
      this.fireError([error as Error, msg, undefined]);
      return Promise.reject(error as Error);
    }
  }

  end(): void {
    this.fireClose();
  }

  signalClose(): void {
    this.fireClose();
  }

  signalError(error: Error): void {
    this.fireError([error, undefined, undefined]);
  }
}

export function createNativeBridgeTransport(): NativeBridgeTransport {
  const reader = new BridgeMessageReader();
  let messageHandler: ((rawJson: string) => void) | undefined;
  let closeHandler: (() => void) | undefined;
  let disposed = false;

  const writer = new BridgeMessageWriter((message) => {
    if (disposed || !messageHandler) return;
    messageHandler(JSON.stringify(message));
  });

  const lspTransport: LspClientTransport = {
    send(rawJson: string): void {
      if (disposed) return;
      let message: Message;
      try {
        message = JSON.parse(rawJson) as Message;
      } catch (error) {
        reader.signalError(error as Error);
        return;
      }
      reader.push(message);
    },
    close(code: number, reason: string): void {
      void code;
      void reason;
      if (disposed) return;
      disposed = true;
      reader.signalClose();
      writer.signalClose();
      closeHandler?.();
    },
    onMessage(handler: (rawJson: string) => void): void {
      messageHandler = handler;
    },
    onClose(handler: () => void): void {
      closeHandler = handler;
    },
  };

  const messageTransports: MessageTransports = {
    reader,
    writer,
    detached: false,
  };

  return {
    messageTransports,
    lspTransport,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      reader.signalClose();
      writer.signalClose();
      closeHandler?.();
    },
  };
}
