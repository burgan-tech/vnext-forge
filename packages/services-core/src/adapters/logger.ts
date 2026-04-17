/**
 * Lightweight logger contract used by services-core.
 *
 * Intentionally a subset of common logger APIs (pino, console, VS Code
 * OutputChannel) so each shell can plug in its native sink:
 * - apps/web-server: pino bridge.
 * - apps/extension : VS Code OutputChannel bridge.
 *
 * Services MUST NOT use `console.*` directly; they accept a `LoggerAdapter`
 * via dependency injection and call it instead.
 */
export interface LoggerAdapter {
  debug(message: string): void
  debug(payload: LogPayload, message?: string): void
  info(message: string): void
  info(payload: LogPayload, message?: string): void
  warn(message: string): void
  warn(payload: LogPayload, message?: string): void
  error(message: string): void
  error(payload: LogPayload, message?: string): void
}

export type LogPayload = Record<string, unknown> | undefined
