import type { DataSchema } from '@burgantech/pseudo-ui';

import * as QuickRunApi from '../QuickRunApi';
import { extractSchemaFromGetDataResult } from './extractSchemaFromGetDataResult';
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

      // R22: engine envelope shape varies (data.data.schema vs
      // data.schema vs schema-in-place). Delegate to a resilient
      // extractor so dropdowns / radio groups don't silently lose
      // their enum + x-enum options when the response shape drifts.
      const schema = extractSchemaFromGetDataResult(result.data);
      if (schema) return schema;

      // Surface the failure so the next debugging round doesn't have
      // to guess. Include the URN + any trace id from the response so
      // engine-side correlation is one log line away.
      const traceId =
        // `getData` is typed as DataResponse which doesn't carry response
        // headers; check defensively in case future schema adds them.
        (result.data as { responseHeaders?: Record<string, string> })?.responseHeaders?.[
          'x-trace-id'
        ] ?? '(no trace id)';
      console.warn(
        `[createDataSchemaResolver] sys-schemas response did not contain a recognizable JSON schema for "${dataSchemaRef}" (trace=${traceId}). Dropdowns / enum-driven inputs will render without options.`,
      );
      return null;
    } catch {
      return null;
    }
  };
}
