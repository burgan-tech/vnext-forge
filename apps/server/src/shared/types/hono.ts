import type { AppLogger } from '../lib/logger.js';

declare module 'hono' {
  interface ContextVariableMap {
    logger: AppLogger;
    traceId: string;
  }
}

export type Variables = {
  logger: AppLogger;
  traceId: string;
};
