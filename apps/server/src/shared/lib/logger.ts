import type { Context } from 'hono'
import pino, { type Logger as PinoLogger } from 'pino'

import { config } from '../config/config.js'

export type AppLogger = Pick<PinoLogger, 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'> & {
  child(bindings: Record<string, unknown>): AppLogger
}

const redactedPaths = [
  'authorization',
  'cookie',
  'token',
  'password',
  'secret',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
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
