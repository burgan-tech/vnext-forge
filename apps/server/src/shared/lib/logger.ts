import type { Context } from 'hono'
import pino, { type Logger, stdSerializers } from 'pino'

export type AppLogger = Logger

const redactedPaths = [
  'authorization',
  'cookie',
  'token',
  'password',
  'secret',
  'headers.authorization',
  'headers.cookie',
  'headers.token',
  'headers.password',
  'headers.secret',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.token',
  'req.headers.password',
  'req.headers.secret',
]

export const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: '@vnext-studio/server',
    env: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: redactedPaths,
    censor: '[REDACTED]',
  },
  serializers: {
    err: stdSerializers.err,
    error: stdSerializers.err,
  },
})

export function getRequestLogger(c: Context, source: string): AppLogger {
  return c.get('logger').child({ source })
}
