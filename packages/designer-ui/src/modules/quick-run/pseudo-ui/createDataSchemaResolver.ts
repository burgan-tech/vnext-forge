import type { DataSchema } from '@burgan-tech/pseudo-ui';

import * as QuickRunApi from '../QuickRunApi';
import { extractSchemaFromGetDataResult } from './extractSchemaFromGetDataResult';
import { parseVnextResUrn, RES_KEY_TO_FLOW } from './parseVnextResUrn';

export type SchemaResolver = (dataSchemaRef: string) => Promise<DataSchema | null>;

export function createDataSchemaResolver(params: {
  domain: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}): SchemaResolver {
  return async (dataSchemaRef: string): Promise<DataSchema | null> => {
    try {
      // Schema-specific resolver: gate on res-key so a stray view /
      // function URN doesn't accidentally hit sys-schemas. Once a
      // generic resource resolver lands this branch becomes a
      // `RES_KEY_TO_FLOW[parsed.resKey]` lookup.
      const parsed = parseVnextResUrn(dataSchemaRef);
      if (!parsed || parsed.resKey !== 'schema') return null;

      const result = await QuickRunApi.getData({
        domain: params.domain,
        workflowKey: RES_KEY_TO_FLOW.schema,
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
