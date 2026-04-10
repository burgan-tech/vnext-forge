import type { Context } from 'hono'
import pino, { type Logger as PinoLogger } from 'pino'

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

const level = process.env.LOG_LEVEL ?? 'info'
const verbose = process.env.VERBOSE === 'true'

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: process.stdout.isTTY,
    translateTime: 'SYS:HH:MM:ss',
    // In default mode show only time + level + message; verbose mode shows all fields
    ignore: verbose ? 'pid,hostname' : 'pid,hostname,service,env,traceId,source,method,path',
    singleLine: true,
  },
})

export const baseLogger: AppLogger = pino(
  {
    level,
    base: {
      service: '@vnext-forge/server',
      env: process.env.NODE_ENV ?? 'development',
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
