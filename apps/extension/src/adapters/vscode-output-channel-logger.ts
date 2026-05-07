import * as vscode from 'vscode';

import type { LoggerAdapter, LogPayload } from '@vnext-forge-studio/services-core';

/**
 * VS Code `LoggerAdapter` that writes structured lines into an OutputChannel.
 *
 * The existing `src/shared/logger.ts` is kept for call-sites that use the
 * extension-local child logger pattern. This factory exists so `services-core`
 * services can be wired up via DI without depending on that module's internal
 * shape.
 */
export function createVsCodeOutputChannelLogger(
  channel: vscode.OutputChannel,
): LoggerAdapter {
  function format(level: string, payloadOrMessage: LogPayload | string, message?: string): string {
    if (typeof payloadOrMessage === 'string') {
      return `[${level}] ${payloadOrMessage}`;
    }
    const msg = message ?? '';
    let tail = '';
    if (
      payloadOrMessage !== undefined &&
      payloadOrMessage !== null &&
      Object.keys(payloadOrMessage).length > 0
    ) {
      try {
        tail = JSON.stringify(payloadOrMessage);
      } catch {
        tail = String(payloadOrMessage);
      }
    }
    return `[${level}] ${[msg, tail].filter(Boolean).join(' ')}`;
  }

  function make(level: string) {
    return (payloadOrMessage: LogPayload | string, message?: string): void => {
      channel.appendLine(format(level, payloadOrMessage, message));
    };
  }

  return {
    debug: make('DEBUG') as LoggerAdapter['debug'],
    info: make('INFO') as LoggerAdapter['info'],
    warn: make('WARN') as LoggerAdapter['warn'],
    error: make('ERROR') as LoggerAdapter['error'],
  };
}
