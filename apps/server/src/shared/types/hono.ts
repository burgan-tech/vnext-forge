import type { AppLogger } from '@shared/lib/logger.js'

declare module 'hono' {
  interface ContextVariableMap {
    logger: AppLogger
    traceId: string
  }
}

export {}
