import type { LoggerAdapter, LogPayload } from '@vnext-forge/services-core';

interface PinoLikeLogger {
  debug(message: string): void;
  debug(payload: Record<string, unknown>, message?: string): void;
  info(message: string): void;
  info(payload: Record<string, unknown>, message?: string): void;
  warn(message: string): void;
  warn(payload: Record<string, unknown>, message?: string): void;
  error(message: string): void;
  error(payload: Record<string, unknown>, message?: string): void;
}

/**
 * Bridges a Pino logger to the `LoggerAdapter` contract used by services-core
 * and lsp-core. Both call patterns are supported:
 *   logger.info('hello')
 *   logger.info({ traceId: '…' }, 'hello')
 */
export function createPinoLoggerAdapter(pino: PinoLikeLogger): LoggerAdapter {
  function write(level: 'debug' | 'info' | 'warn' | 'error') {
    return (
      payloadOrMessage: string | LogPayload,
      message?: string,
    ): void => {
      if (typeof payloadOrMessage === 'string') {
        pino[level](payloadOrMessage);
        return;
      }
      pino[level](payloadOrMessage ?? {}, message);
    };
  }

  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  };
}
