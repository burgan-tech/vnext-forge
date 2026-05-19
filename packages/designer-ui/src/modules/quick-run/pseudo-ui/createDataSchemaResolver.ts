import type { DataSchema } from '@burgantech/pseudo-ui';

import * as QuickRunApi from '../QuickRunApi';
import { parseDataSchemaRef } from './parseDataSchemaRef';

export type SchemaResolver = (dataSchemaRef: string) => Promise<DataSchema | null>;

export function createDataSchemaResolver(params: {
  domain: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}): SchemaResolver {
  return async (dataSchemaRef: string): Promise<DataSchema | null> => {
    try {
      const parsed = parseDataSchemaRef(dataSchemaRef);
      if (!parsed) return null;

      const result = await QuickRunApi.getData({
        domain: params.domain,
        workflowKey: 'sys-schemas',
        instanceId: parsed.key,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      });

      if (!result.success) return null;

      const dataObj = result.data.data as Record<string, unknown> | undefined;
      const schemaObj = dataObj?.schema;
      if (!schemaObj || typeof schemaObj !== 'object') return null;

      return schemaObj as DataSchema;
    } catch {
      return null;
    }
  };
}
