/**
 * R22 (rev R26): resilient schema extraction from the engine's
 * `getData` reply.
 *
 * The current vNext engine returns sys-schemas instances with the
 * actual JSON Schema under `attributes.schema`; older engines used
 * `data.data.schema` or `data.schema`. Without resilience here, any
 * envelope mismatch causes `createDataSchemaResolver` to return
 * `null` silently and `PseudoUiViewSurface` falls back to an empty
 * schema — the symptom is dropdowns / radio groups with no options,
 * even though the trace shows a perfectly valid schema in the
 * response body.
 *
 * Strategy: try several candidate paths in priority order, return
 * the first one that "looks like" a JSON-schema object (has
 * `properties` or `type === 'object'`). Pure + side-effect-free so
 * the resolver stays trivial and the heuristic is unit-testable in
 * isolation.
 *
 * Ordering rationale:
 *   1. `data.attributes.schema` — current vNext engine shape (the
 *      resolver passes `result.data` from QuickRunApi.getData, which
 *      wraps the engine instance under its own `data` field, so the
 *      engine's top-level `attributes` lands under `data.attributes`
 *      here).
 *   2. `attributes.schema` — same shape but seen one level shallower
 *      when the engine response reaches us without the QuickRunApi
 *      envelope.
 *   3. `data.data.schema` — Forge's original expectation, kept for
 *      back-compat with the legacy sys-schemas wire shape.
 *   4. `data.schema` — single envelope nesting (also legacy).
 *   5. `data.data` — schema with no `.schema` wrapper (rare).
 *   6. `data` — schema returned with no envelope at all (defensive).
 *
 * The shape-based fallbacks (5, 6) come *after* every explicit
 * `.schema` field check, so the heuristic never mis-classifies real
 * instance data (which typically doesn't have `properties` /
 * `type: object`) as a schema by accident.
 */

import type { DataSchema } from '@burgan-tech/pseudo-ui';

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
  const rootAttrs = isObject(root.attributes) ? (root.attributes as Record<string, unknown>) : undefined;
  const dataAttrs = isObject(dataField?.attributes)
    ? (dataField!.attributes as Record<string, unknown>)
    : undefined;
  const innerData = isObject(dataField?.data) ? (dataField!.data as Record<string, unknown>) : undefined;
  return [
    // ── Current vNext engine shape — schema lives under `attributes.schema`.
    dataAttrs?.schema, // data.attributes.schema (QuickRunApi-wrapped engine instance)
    rootAttrs?.schema, // attributes.schema      (engine instance handed directly)
    // ── Legacy envelopes kept for back-compat.
    innerData?.schema, // data.data.schema (legacy Forge expectation)
    dataField?.schema, // data.schema      (single-envelope nesting)
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
