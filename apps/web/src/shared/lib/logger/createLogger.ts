export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LoggerPayload = unknown;
type ConsoleMethod = (...args: unknown[]) => void;

export interface CreateLoggerOptions {
  minLevel?: LogLevel;
}

export interface Logger {
  readonly scope: string;
  debug: (message: string, payload?: LoggerPayload) => void;
  info: (message: string, payload?: LoggerPayload) => void;
  warn: (message: string, payload?: LoggerPayload) => void;
  error: (message: string, payload?: LoggerPayload) => void;
  child: (scope: string, options?: CreateLoggerOptions) => Logger;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEYWORDS = ['authorization', 'token', 'password', 'secret', 'cookie'];
const MAX_SANITIZE_DEPTH = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getImportMetaEnv(): Record<string, unknown> {
  const importMetaValue: unknown = import.meta;

  if (!isRecord(importMetaValue)) {
    return {};
  }

  const env = importMetaValue.env;

  return isRecord(env) ? env : {};
}

function getBooleanEnv(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function toLevel(value: unknown, fallback: LogLevel): LogLevel {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === 'debug' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error'
  ) {
    return normalized;
  }

  return fallback;
}

function getDefaultMinLevel(): LogLevel {
  const env = getImportMetaEnv();
  const isProduction = getBooleanEnv(env.PROD, false);
  const fallbackLevel: LogLevel = isProduction ? 'warn' : 'debug';

  return toLevel(env.VITE_LOG_LEVEL, fallbackLevel);
}

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function redactStringValue(value: string): string {
  return value.toLowerCase().startsWith('bearer ') ? 'Bearer [REDACTED]' : value;
}

function sanitize(payload: unknown, depth = 0): LoggerPayload {
  if (depth > MAX_SANITIZE_DEPTH) {
    return '[MaxDepth]';
  }

  if (payload instanceof Error) {
    const errorRecord = payload as Error & {
      toLogEntry?: () => unknown;
      toJSON?: () => unknown;
      cause?: unknown;
    };

    if (typeof errorRecord.toLogEntry === 'function') {
      return sanitize(errorRecord.toLogEntry(), depth + 1);
    }

    if (typeof errorRecord.toJSON === 'function') {
      return sanitize(errorRecord.toJSON(), depth + 1);
    }

    return {
      name: payload.name,
      message: payload.message,
      stack: payload.stack,
      ...(errorRecord.cause !== undefined ? { cause: sanitize(errorRecord.cause, depth + 1) } : {}),
    };
  }

  if (typeof payload === 'string') {
    return redactStringValue(payload);
  }

  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitize(item, depth + 1));
  }

  if (!isRecord(payload)) {
    return '[UnsupportedPayload]';
  }

  const sanitizedObject: Record<string, LoggerPayload> = {};

  for (const [key, value] of Object.entries(payload)) {
    sanitizedObject[key] = isSensitiveKey(key) ? '[REDACTED]' : sanitize(value, depth + 1);
  }

  return sanitizedObject;
}

function getConsoleMethod(level: LogLevel): ConsoleMethod {
  switch (level) {
    case 'debug':
      return console.debug.bind(console);
    case 'info':
      return console.info.bind(console);
    case 'warn':
      return console.warn.bind(console);
    case 'error':
      return console.error.bind(console);
  }
}

function createPrefix(scope: string, level: LogLevel): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${scope}]`;
}

function print(
  level: LogLevel,
  scope: string,
  minLevel: LogLevel,
  message: string,
  payload?: LoggerPayload,
): void {
  if (!shouldLog(level, minLevel)) {
    return;
  }

  const consoleMethod = getConsoleMethod(level);
  const prefix = createPrefix(scope, level);

  if (payload === undefined) {
    consoleMethod(prefix, message);
    return;
  }

  consoleMethod(prefix, message, sanitize(payload));
}

export function createLogger(scope: string, options?: CreateLoggerOptions): Logger {
  const minLevel = options?.minLevel ?? getDefaultMinLevel();

  return {
    scope,
    debug: (message, payload) => print('debug', scope, minLevel, message, payload),
    info: (message, payload) => print('info', scope, minLevel, message, payload),
    warn: (message, payload) => print('warn', scope, minLevel, message, payload),
    error: (message, payload) => print('error', scope, minLevel, message, payload),
    child: (childScope, childOptions) =>
      createLogger(`${scope}:${childScope}`, {
        minLevel: childOptions?.minLevel ?? minLevel,
      }),
  };
}
