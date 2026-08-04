/**
 * Tells apart two very different validation failures that AJV reports
 * identically as `must NOT have additional property "x"`:
 *
 *  1. **Version skew** — the property is part of the contract Forge offers, but
 *     the project pins an older `schemaVersion` that predates it. The document
 *     is not wrong; the project's pin is behind.
 *
 *  2. **A genuine defect** — a typo or stale field that Forge does not author
 *     and no schema declares.
 *
 * Why this matters: every vNext component schema sets
 * `additionalProperties: false`, and the pre-write gate in `useSaveComponent`
 * blocks the save outright on any error. Without this distinction, authoring a
 * current field on an older-pinned project makes the whole file unsaveable —
 * including edits that have nothing to do with that field — and the only way
 * out is hand-editing JSON. Case 1 is therefore downgraded to a warning;
 * case 2 keeps blocking.
 *
 * "Part of the contract Forge offers" has two sources, checked in this order:
 *
 *  - `FORGE_AUTHORED_ATTRIBUTES` — properties Forge's editors implement ahead of
 *    the schema release it bundles. This is the load-bearing one: Forge's pin is
 *    `^0.0.39`, which predates every field in that list, so the bundled schema
 *    alone would classify all of them as defects.
 *  - the **bundled schema** — so once the pin is raised, coverage continues
 *    without touching the list, and it generalizes to any component type.
 */

import { isForgeAuthoredAttribute } from './forgeAuthoredContract';

export interface SkewClassifiableError {
  /** AJV `instancePath`, e.g. `/attributes` or `/attributes/onExecutionTasks/0`. */
  path: string;
  message: string;
  params?: Record<string, unknown>;
}

export interface PartitionedValidationErrors<T> {
  /** Errors that must still block the save. */
  blocking: T[];
  /** Version-skew errors, safe to save through. */
  skew: T[];
  /** Property names behind `skew`, de-duplicated in first-seen order. */
  skewProperties: string[];
}

/**
 * The property name an `additionalProperties` error is complaining about, or
 * `null` when this error is not of that kind.
 */
function additionalPropertyName(error: SkewClassifiableError): string | null {
  const name = error.params?.additionalProperty;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

/**
 * Walks a JSON Schema to the node addressed by an AJV `instancePath`.
 *
 * Only the constructs these component schemas actually use are followed:
 * `properties/<key>` for object segments and `items` for array indices.
 * Anything unrecognized returns `null`, which callers treat as "cannot prove
 * this is skew" — deliberately failing closed so an unclassifiable error keeps
 * blocking.
 */
export function resolveSchemaAtInstancePath(
  schema: Record<string, unknown> | null | undefined,
  instancePath: string,
): Record<string, unknown> | null {
  if (!schema) return null;

  const segments = instancePath.split('/').filter((segment) => segment.length > 0);
  let node: Record<string, unknown> = schema;

  for (const rawSegment of segments) {
    // AJV escapes `~` and `/` per RFC 6901.
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');

    if (/^\d+$/.test(segment)) {
      const items = node.items;
      if (!isPlainObject(items)) return null;
      node = items;
      continue;
    }

    const properties = node.properties;
    if (!isPlainObject(properties)) return null;
    const next = properties[segment];
    if (!isPlainObject(next)) return null;
    node = next;
  }

  return node;
}

export interface SkewClassificationContext {
  /** Component type, e.g. `'function'` — keys `FORGE_AUTHORED_ATTRIBUTES`. */
  componentType?: string;
  /** Forge's bundled schema, when resolved. */
  bundledSchema?: Record<string, unknown> | null;
}

/**
 * True when `error` is an `additionalProperties` violation for a property Forge
 * offers — i.e. pure version skew between Forge's contract and the project's
 * pinned one.
 */
export function isVersionSkewError(
  error: SkewClassifiableError,
  context: SkewClassificationContext,
): boolean {
  const property = additionalPropertyName(error);
  if (!property) return false;

  // Forge's own editors are the authority for fields it ships ahead of the
  // bundled schema. Scoped to `/attributes`, which is where they all live.
  if (error.path === '/attributes' && isForgeAuthoredAttribute(context.componentType, property)) {
    return true;
  }

  const node = resolveSchemaAtInstancePath(context.bundledSchema, error.path);
  if (!node) return false;

  const properties = node.properties;
  if (!isPlainObject(properties)) return false;

  return Object.prototype.hasOwnProperty.call(properties, property);
}

/**
 * Splits validation errors into the ones that must block the save and the ones
 * that are merely version skew.
 *
 * With neither a known component type nor a resolved bundled schema, nothing is
 * classified as skew and everything blocks — the safe direction.
 */
export function partitionVersionSkewErrors<T extends SkewClassifiableError>(
  errors: readonly T[],
  context: SkewClassificationContext,
): PartitionedValidationErrors<T> {
  const blocking: T[] = [];
  const skew: T[] = [];
  const skewProperties: string[] = [];

  for (const error of errors) {
    if (isVersionSkewError(error, context)) {
      skew.push(error);
      const property = additionalPropertyName(error);
      if (property && !skewProperties.includes(property)) skewProperties.push(property);
    } else {
      blocking.push(error);
    }
  }

  return { blocking, skew, skewProperties };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
