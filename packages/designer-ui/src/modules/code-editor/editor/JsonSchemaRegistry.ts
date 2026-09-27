import { callApi } from '../../../api/client';
import { createLogger } from '../../../lib/logger/createLogger';

const logger = createLogger('JsonSchemaRegistry');

/** `validate/getAllSchemas` result: component type → JSON Schema (forward-ports already applied by services-core). */
export type VnextSchemaMap = Record<string, object>;

const BUNDLED_KEY = '__bundled__';
const cache = new Map<string, VnextSchemaMap>();
const inflight = new Map<string, Promise<VnextSchemaMap | null>>();

function cacheKey(schemaVersion: string | undefined): string {
  return schemaVersion ?? BUNDLED_KEY;
}

/**
 * Component schemas for `schemaVersion` (the project's
 * `vnext.config.json#schemaVersion`; omitted → the package bundled with the
 * backend). Cached per version; concurrent calls share one request.
 */
export async function fetchVnextSchemas(schemaVersion?: string): Promise<VnextSchemaMap | null> {
  const key = cacheKey(schemaVersion);
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await callApi<VnextSchemaMap>({
        method: 'validate/getAllSchemas',
        params: schemaVersion ? { schemaVersion } : {},
      });
      if (response.success) {
        cache.set(key, response.data);
        logger.info(`Loaded ${Object.keys(response.data).length} vnext schemas (${key})`);
        return response.data;
      }
      logger.warn('Failed to load vnext schemas from server');
      return null;
    } catch {
      logger.warn('Error fetching vnext schemas');
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, request);
  return request;
}

export function getCachedSchemas(schemaVersion?: string): VnextSchemaMap | null {
  return cache.get(cacheKey(schemaVersion)) ?? null;
}

export function invalidateSchemaCache(): void {
  cache.clear();
  inflight.clear();
}
