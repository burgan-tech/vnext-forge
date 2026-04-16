import { apiClient, callApi } from '@shared/api/client';
import { createLogger } from '@shared/lib/logger/createLogger';

const logger = createLogger('JsonSchemaRegistry');

interface SchemaCache {
  schemas: Record<string, object>;
  types: string[];
}

let cache: SchemaCache | null = null;
let fetchPromise: Promise<SchemaCache | null> | null = null;

export async function fetchVnextSchemas(): Promise<SchemaCache | null> {
  if (cache) return cache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const response = await callApi<SchemaCache>(
        apiClient.api.validate.schemas.$get(),
      );
      if (response.success) {
        cache = response.data;
        logger.info(`Loaded ${Object.keys(cache.schemas).length} vnext schemas`);
        return cache;
      }
      logger.warn('Failed to load vnext schemas from server');
      return null;
    } catch (error) {
      logger.warn('Error fetching vnext schemas');
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function getCachedSchemas(): SchemaCache | null {
  return cache;
}

export function invalidateSchemaCache(): void {
  cache = null;
}
