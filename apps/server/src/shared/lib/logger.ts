import type { Context } from 'hono'
import pino, { type Logger as PinoLogger } from 'pino'

import { config } from '../config/config.js'

export type AppLogger = Pick<PinoLogger, 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'> & {
  child(bindings: Record<string, unknown>): AppLogger
}

// Pino redact paths. We redact a generous superset of common secret-bearing
// field names so that even unstructured `details` blobs that bubble up from
// services-core never leak sensitive material. Wildcards (`*`) are scoped to
// avoid the catastrophic "redact every field" pattern.
const redactedPaths = [
  // Direct top-level fields commonly attached to log records.
  'authorization',
  'cookie',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'idToken',
  'id_token',
  'apiKey',
  'api_key',
  'password',
  'passphrase',
  'secret',
  'clientSecret',
  'client_secret',
  'privateKey',
  'private_key',
  // HTTP request/response headers we proxy or mirror.
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  // Bounded-depth wildcards over the structured `details` envelope used by
  // `VnextForgeError`. Pino does NOT support unbounded `**` wildcards, so we
  // explicitly enumerate the depths we expect.
  'details.authorization',
  'details.cookie',
  'details.token',
  'details.accessToken',
  'details.refreshToken',
  'details.apiKey',
  'details.password',
  'details.secret',
  'details.headers.authorization',
  'details.headers.cookie',
  // Same envelope nested one level deeper (e.g. proxy bodies).
  'details.body.authorization',
  'details.body.token',
  'details.body.password',
  'details.body.secret',
  'details.body.apiKey',
]

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: process.stdout.isTTY,
    translateTime: 'SYS:HH:MM:ss',
    // In default mode show only time + level + message; verbose mode shows all fields
    ignore: config.verbose ? 'pid,hostname' : 'pid,hostname,service,env,traceId,source,method,path',
    singleLine: true,
  },
})

export const baseLogger: AppLogger = pino(
  {
    level: config.logLevel,
    base: {
      service: '@vnext-forge/server',
      env: config.nodeEnv,
    },
    redact: {
      paths: redactedPaths,
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  },
  transport,
)

export function formatDuration(durationMs: number): string {
  return `${durationMs.toFixed(1)} ms`
}

export function formatBytes(bytes: number): string {
  return `${bytes} B`
}

export function getRequestLogger(c: Context, source: string): AppLogger {
  return c.get('logger').child({ source })
}
