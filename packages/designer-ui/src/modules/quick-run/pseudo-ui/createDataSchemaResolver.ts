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
      if (!parsed || parsed.resKey !== 'schema') {
        // eslint-disable-next-line no-console -- diagnostic surface for "empty dropdown" debug rounds.
        console.warn('[createDataSchemaResolver] URN parse fail or non-schema res-key', {
          urn: dataSchemaRef,
          parsedKind: parsed?.resKey ?? null,
        });
        return null;
      }

      const result = await QuickRunApi.getData({
        domain: params.domain,
        workflowKey: RES_KEY_TO_FLOW.schema,
        instanceId: parsed.key,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      });

      if (!result.success) {
        // eslint-disable-next-line no-console
        console.warn('[createDataSchemaResolver] engine error', {
          urn: dataSchemaRef,
          domain: params.domain,
          workflowKey: RES_KEY_TO_FLOW.schema,
          instanceId: parsed.key,
          code: result.error.code,
          message: result.error.message,
        });
        return null;
      }

      // R22 (rev R26): engine envelope shape varies — current vNext
      // engine returns the schema under `attributes.schema`. The
      // resilient extractor walks every known candidate so dropdowns
      // / radio groups don't silently lose their enum + x-enum
      // options when the response shape drifts.
      const schema = extractSchemaFromGetDataResult(result.data);
      if (schema) return schema;

      // Surface the failure so the next debugging round doesn't have
      // to guess. Include the URN + any trace id from the response so
      // engine-side correlation is one log line away.
      const traceId =
        (result.data as { responseHeaders?: Record<string, string> })?.responseHeaders?.[
          'x-trace-id'
        ] ?? '(no trace id)';
      // eslint-disable-next-line no-console
      console.warn('[createDataSchemaResolver] envelope unwrap miss', {
        urn: dataSchemaRef,
        domain: params.domain,
        workflowKey: RES_KEY_TO_FLOW.schema,
        instanceId: parsed.key,
        traceId,
        message:
          'sys-schemas response did not contain a recognizable JSON schema. Dropdowns / enum-driven inputs will render without options.',
      });
      return null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[createDataSchemaResolver] threw', {
        urn: dataSchemaRef,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  };
}
