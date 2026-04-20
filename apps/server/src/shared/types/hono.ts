import type { AppLogger } from '../lib/logger.js';

declare module 'hono' {
  interface ContextVariableMap {
    logger: AppLogger;
    traceId: string;
    /** W3C traceparent trace id (link only; never equals `traceId`). */
    linkedTraceId?: string;
  }
}

export type Variables = {
  logger: AppLogger;
  traceId: string;
  linkedTraceId?: string;
};
