/**
 * Builds the runtime's instance-list `filter` JSON from the Quick Run filter
 * panel's conditions.
 *
 * The runtime (PR #881, "Reject Unsupported Filter") is fail-closed: a value of
 * the wrong JSON shape is no longer dropped silently, it is a 400. So every
 * operator has to travel with the shape the runtime's converter expects:
 *
 * - `in` / `nin` / `between` → JSON **array**
 * - `isNull` → JSON **boolean**
 * - `includes` → JSON **object** (attribute containment)
 * - numeric / boolean attribute values → JSON number / boolean
 * - dates → ISO-8601 (UTC) strings
 * - attribute paths → `attributes.<seg>(.<seg>)*` with `^[a-zA-Z0-9_]+$` segments
 *
 * Wire operators: `GraphQLFilterModels.Supported` in the runtime. Value
 * shapes: `GraphQLFilterNodeConverter` + `docs/how-to/instance-filtering.md`.
 */

export type FilterOperator =
  | 'eq' | 'ne'
  | 'gt' | 'ge' | 'lt' | 'le'
  | 'between'
  | 'like' | 'match' | 'startswith' | 'endswith'
  | 'in' | 'nin'
  | 'isNull'
  | 'includes';

export type FieldCategory = 'instance' | 'attribute';

/** How an attribute value should be coerced before it goes on the wire. */
export type FilterValueType = 'text' | 'number' | 'boolean' | 'date';

export type InstanceFieldType = 'string' | 'status' | 'date';

export interface FilterCondition {
  category: FieldCategory;
  field: string;
  operator: FilterOperator;
  value: string;
  /** Upper bound for `between`. */
  value2?: string;
  /** Attribute conditions only; instance fields derive their type from `INSTANCE_FIELDS`. */
  valueType?: FilterValueType;
}

/** Instance columns the runtime accepts in `filter` (see `InstanceFieldDiscriminator`). */
export const INSTANCE_FIELDS: { value: string; label: string; type: InstanceFieldType }[] = [
  { value: 'status', label: 'Status', type: 'status' },
  { value: 'currentState', label: 'Current State', type: 'string' },
  { value: 'effectiveState', label: 'Effective State', type: 'string' },
  { value: 'stage', label: 'Stage', type: 'string' },
  { value: 'id', label: 'Id', type: 'string' },
  { value: 'key', label: 'Key', type: 'string' },
  { value: 'createdBy', label: 'Created By', type: 'string' },
  { value: 'modifiedBy', label: 'Modified By', type: 'string' },
  { value: 'createdAt', label: 'Created At', type: 'date' },
  { value: 'modifiedAt', label: 'Modified At', type: 'date' },
  { value: 'completedAt', label: 'Completed At', type: 'date' },
];

/** Runtime accepts names or single-letter codes; names read better in the UI. */
export const STATUS_OPTIONS = ['Active', 'Busy', 'Completed', 'Faulted', 'Passive'] as const;

export const ALL_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'ge', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'le', label: '≤' },
  { value: 'between', label: 'between' },
  { value: 'like', label: 'contains' },
  { value: 'match', label: 'matches' },
  { value: 'startswith', label: 'starts with' },
  { value: 'endswith', label: 'ends with' },
  { value: 'in', label: 'in list' },
  { value: 'nin', label: 'not in list' },
  { value: 'isNull', label: 'is null' },
  { value: 'includes', label: 'includes (JSON)' },
];

export type ResolvedFieldType = InstanceFieldType | 'attribute';

export function getFieldType(category: FieldCategory, field: string): ResolvedFieldType {
  if (category === 'attribute') return 'attribute';
  const def = INSTANCE_FIELDS.find((f) => f.value === field);
  return def?.type ?? 'string';
}

export function getOperatorsForFieldType(type: ResolvedFieldType, valueType: FilterValueType = 'text'): FilterOperator[] {
  switch (type) {
    case 'status': return ['eq', 'ne', 'in', 'nin'];
    case 'date': return ['eq', 'gt', 'ge', 'lt', 'le', 'between', 'isNull'];
    case 'string': return ['eq', 'ne', 'like', 'match', 'startswith', 'endswith', 'in', 'nin', 'isNull'];
    case 'attribute':
      switch (valueType) {
        case 'number': return ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'between', 'in', 'nin', 'isNull'];
        case 'boolean': return ['eq', 'ne', 'isNull'];
        case 'date': return ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'between', 'isNull'];
        default: return ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'between', 'like', 'match', 'startswith', 'endswith', 'in', 'nin', 'isNull', 'includes'];
      }
    default: return ['eq', 'ne'];
  }
}

/** `isNull` takes no value. Everything else needs at least `value`. */
export function operatorNeedsValue(op: FilterOperator): boolean {
  return op !== 'isNull';
}

const ATTRIBUTE_SEGMENT = /^[a-zA-Z0-9_]+$/;

/** `a`, `a.b`, `a_1.b2` — the runtime rejects any other segment shape as an unsafe path. */
export function isValidAttributePath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return false;
  return trimmed.split('.').every((seg) => ATTRIBUTE_SEGMENT.test(seg));
}

/** Resolve the coercion type of a condition's value(s). */
export function resolveValueType(c: FilterCondition): FilterValueType {
  if (c.category === 'attribute') return c.valueType ?? 'text';
  const t = getFieldType(c.category, c.field);
  return t === 'date' ? 'date' : 'text';
}

type Scalar = string | number | boolean;

function coerceScalar(raw: string, type: FilterValueType): { value?: Scalar; error?: string } {
  const v = raw.trim();
  if (!v) return { error: 'Value is required.' };
  switch (type) {
    case 'number': {
      const n = Number(v);
      return Number.isFinite(n) ? { value: n } : { error: `"${v}" is not a number.` };
    }
    case 'boolean': {
      if (v === 'true') return { value: true };
      if (v === 'false') return { value: false };
      return { error: 'Use true or false.' };
    }
    case 'date': {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? { error: `"${v}" is not a valid date.` } : { value: d.toISOString() };
    }
    default:
      return { value: v };
  }
}

export interface SerializedCondition {
  node?: Record<string, unknown>;
  error?: string;
}

/** Serialize one condition into a runtime filter node, or an error message for the row. */
export function serializeCondition(c: FilterCondition): SerializedCondition {
  const field = c.field.trim();
  if (!field) return { error: 'Field is required.' };
  if (c.category === 'attribute' && !isValidAttributePath(field)) {
    return { error: 'Attribute path segments may only contain letters, digits and underscores (e.g. amount or customer.id).' };
  }
  const type = resolveValueType(c);

  let wireValue: unknown;
  switch (c.operator) {
    case 'isNull':
      wireValue = true;
      break;
    case 'in':
    case 'nin': {
      const parts = c.value.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length === 0) return { error: 'Enter one or more comma-separated values.' };
      const coerced: Scalar[] = [];
      for (const part of parts) {
        const r = coerceScalar(part, type);
        if (r.error !== undefined || r.value === undefined) return { error: r.error ?? 'Value is required.' };
        coerced.push(r.value);
      }
      wireValue = coerced;
      break;
    }
    case 'between': {
      const lo = coerceScalar(c.value, type);
      if (lo.error) return { error: `Lower bound: ${lo.error}` };
      const hi = coerceScalar(c.value2 ?? '', type);
      if (hi.error) return { error: `Upper bound: ${hi.error}` };
      wireValue = [lo.value, hi.value];
      break;
    }
    case 'includes': {
      if (c.category !== 'attribute') return { error: '"includes" only applies to attributes.' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(c.value);
      } catch {
        return { error: '"includes" needs a JSON object, e.g. {"role":"admin"}.' };
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: '"includes" needs a JSON object, e.g. {"role":"admin"}.' };
      }
      wireValue = parsed;
      break;
    }
    case 'like':
    case 'match':
    case 'startswith':
    case 'endswith': {
      const v = c.value.trim();
      if (!v) return { error: 'Value is required.' };
      wireValue = v;
      break;
    }
    default: {
      const r = coerceScalar(c.value, type);
      if (r.error) return { error: r.error };
      wireValue = r.value;
    }
  }

  const leaf: Record<string, unknown> = { [c.operator]: wireValue };
  if (c.category !== 'attribute') return { node: { [field]: leaf } };
  // Dotted attribute paths nest: `customer.id` → {"attributes":{"customer":{"id":{...}}}}.
  // The runtime's converter treats any non-operator key holding an object as a
  // nested field (`GraphQLFilterNodeConverter`, NestedConditions).
  const nested = field.split('.').reduceRight<Record<string, unknown>>((inner, seg) => ({ [seg]: inner }), leaf);
  return { node: { attributes: nested } };
}

export interface SerializedFilter {
  /** JSON string for the `filter` query parameter; undefined when there are no conditions. */
  filter?: string;
  /** Row index → message. Empty when everything serialized. */
  errors: Record<number, string>;
}

/**
 * Serialize all conditions. Single condition → flat node; several → `{ and: [...] }`.
 * Rows with an empty value (other than `isNull`) are ignored, matching the old
 * "unfilled row" behaviour; rows that are filled but malformed are errors.
 */
export function serializeInstanceFilter(conditions: FilterCondition[]): SerializedFilter {
  const errors: Record<number, string> = {};
  const nodes: Record<string, unknown>[] = [];

  conditions.forEach((c, index) => {
    const untouched = operatorNeedsValue(c.operator) && c.value.trim() === '' && (c.value2 ?? '').trim() === '';
    if (untouched) return;
    const r = serializeCondition(c);
    if (r.error) errors[index] = r.error;
    else if (r.node) nodes.push(r.node);
  });

  if (Object.keys(errors).length > 0) return { errors };
  if (nodes.length === 0) return { errors };
  return { filter: JSON.stringify(nodes.length === 1 ? nodes[0] : { and: nodes }), errors };
}

/** Runtime `sort` parameter: `{"field":"createdAt","direction":"desc"}`. */
export function serializeInstanceSort(field: string, direction: 'asc' | 'desc'): string {
  return JSON.stringify({ field, direction });
}
