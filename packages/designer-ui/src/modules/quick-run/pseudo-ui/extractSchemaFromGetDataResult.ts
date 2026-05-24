/**
 * R22: resilient schema extraction from the engine's `getData` reply.
 *
 * Different engine versions wrap the sys-schemas instance data
 * envelope differently — sometimes the schema lands at
 * `data.data.schema` (legacy / Forge's original expectation), other
 * times at `data.schema` (single envelope level), and we've seen
 * cases where the response collapses the schema in place (no
 * dedicated `.schema` field). Without resilience here, any mismatch
 * causes `createDataSchemaResolver` to return `null` silently and
 * `PseudoUiViewSurface` falls back to an empty schema — the symptom
 * is dropdowns / radio groups with no options, even though the trace
 * shows a perfectly valid schema in the response body.
 *
 * Strategy: try four candidate paths in priority order, return the
 * first one that "looks like" a JSON-schema object (has `properties`
 * or `type === 'object'`). Pure + side-effect-free so the resolver
 * stays trivial and the heuristic is unit-testable in isolation.
 *
 * Ordering rationale:
 *   1. `data.data.schema` — current Forge expectation; keep first so
 *      well-behaved environments take the fast path.
 *   2. `data.schema` — user-reported shape (single envelope nesting).
 *   3. `data.data` — schema with no `.schema` wrapper (rare; usually
 *      a server that bypasses sys-schemas envelope conventions).
 *   4. `data` — schema returned with no envelope at all (defensive).
 *
 * The shape-based fallbacks (3, 4) come *after* every explicit
 * `.schema` field check, so the heuristic never mis-classifies real
 * instance data (which typically doesn't have `properties` /
 * `type: object`) as a schema by accident.
 */

import type { DataSchema } from '@burgantech/pseudo-ui';

export function extractSchemaFromGetDataResult(envelope: unknown): DataSchema | null {
  const candidates = collectSchemaCandidates(envelope);
  for (const candidate of candidates) {
    if (looksLikeSchema(candidate)) {
      return candidate as DataSchema;
    }
  }
  return null;
}

function collectSchemaCandidates(envelope: unknown): unknown[] {
  if (!envelope || typeof envelope !== 'object') return [];
  const root = envelope as Record<string, unknown>;
  const dataField = isObject(root.data) ? (root.data as Record<string, unknown>) : undefined;
  const innerData = isObject(dataField?.data) ? (dataField!.data as Record<string, unknown>) : undefined;
  return [
    innerData?.schema, // data.data.schema (legacy / current expectation)
    dataField?.schema, // data.schema      (user-reported)
    innerData,         // data.data        (schema-in-place)
    dataField,         // data             (no envelope at all)
  ];
}

function looksLikeSchema(value: unknown): boolean {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  // A JSON-schema object exposes at least one of these markers. We
  // accept either to avoid being too strict — some workflow schemas
  // omit `type` when `properties` is present, and vice-versa.
  return obj.properties !== undefined || obj.type === 'object';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
