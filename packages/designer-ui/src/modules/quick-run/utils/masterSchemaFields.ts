/**
 * QuickRunner view of the workflow's master schema, mirroring the runtime:
 * - field collection: `SchemaFilterMetadataResolver` (dotted paths, type
 *   defaults to `string`, recursion into nested `properties`);
 * - operator allowance: `SchemaFilterContext.IsOperatorAllowed` (wire operator
 *   → schema spelling, case-insensitive exact match in `x-filterOperators`);
 * - index use: `AttributeConditionBuilder` storage switch.
 */
import {
  getFieldType,
  getOperatorsForFieldType,
  type FilterCondition,
  type FilterOperator,
  type FilterValueType,
} from './instanceFilterSerializer';

export interface MasterSchemaField {
  /** Dotted instance-data path (`customer.name`). */
  path: string;
  /** JSON Schema `type`; the runtime treats a missing or non-string type as `string`. */
  type: string;
  format?: string;
  indexed: boolean;
  /** `x-filterOperators` verbatim (non-blank strings). Empty → not filterable. */
  filterOperators: string[];
  sortable: boolean;
}

/** Shared with `workflowMasterSchema.ts` — narrows an unknown JSON value to a plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function collectMasterSchemaFields(schemaRoot: unknown): MasterSchemaField[] {
  const fields: MasterSchemaField[] = [];
  const walk = (node: Record<string, unknown>, prefix: string): void => {
    const properties = node.properties;
    if (!isRecord(properties)) return;
    for (const [name, value] of Object.entries(properties)) {
      if (!isRecord(value)) continue;
      const path = prefix === '' ? name : `${prefix}.${name}`;
      const rawOperators: unknown = value['x-filterOperators'];
      fields.push({
        path,
        type: typeof value.type === 'string' ? value.type : 'string',
        ...(typeof value.format === 'string' ? { format: value.format } : {}),
        indexed: value['x-indexed'] === true,
        filterOperators: Array.isArray(rawOperators)
          ? (rawOperators as unknown[]).filter((o): o is string => typeof o === 'string' && o.trim() !== '')
          : [],
        sortable: value['x-sortable'] === true,
      });
      if (value.properties !== undefined) walk(value, path);
    }
  };
  if (isRecord(schemaRoot)) walk(schemaRoot, '');
  return fields;
}

export function findSchemaField(
  fields: readonly MasterSchemaField[] | undefined,
  path: string,
): MasterSchemaField | undefined {
  return fields?.find((f) => f.path === path);
}

export function fieldValueType(field: MasterSchemaField): FilterValueType {
  if (field.type === 'number' || field.type === 'integer') return 'number';
  if (field.type === 'boolean') return 'boolean';
  if (field.type === 'string' && field.format === 'date-time') return 'date';
  return 'text';
}

/** Runtime `SchemaFilterContext.ToSchemaOperator`: wire operator → `x-filterOperators` spelling. */
export const SCHEMA_OPERATOR_FOR_WIRE: Record<FilterOperator, string> = {
  eq: 'eq',
  ne: 'neq',
  gt: 'gt',
  ge: 'gte',
  lt: 'lt',
  le: 'lte',
  between: 'between',
  like: 'contains',
  match: 'contains',
  startswith: 'startsWith',
  endswith: 'endsWith',
  in: 'in',
  nin: 'nin',
  isNull: 'isNull',
  includes: 'includes',
};

export function isOperatorAllowedBySchema(field: MasterSchemaField, op: FilterOperator): boolean {
  const schemaOp = SCHEMA_OPERATOR_FOR_WIRE[op].toLowerCase();
  return field.filterOperators.some((o) => o.toLowerCase() === schemaOp);
}

function typeOperators(c: FilterCondition): FilterOperator[] {
  return getOperatorsForFieldType(getFieldType(c.category, c.field), c.valueType);
}

/**
 * Operators offered for a condition: the type-based list, narrowed to what the
 * master schema grants. Falls back to the type-based list (with a
 * {@link schemaFieldNotice}) when the schema grants nothing usable.
 */
export function operatorsForCondition(
  c: FilterCondition,
  fields?: readonly MasterSchemaField[],
): FilterOperator[] {
  const base = typeOperators(c);
  if (c.category !== 'attribute') return base;
  const field = findSchemaField(fields, c.field.trim());
  if (!field || field.filterOperators.length === 0) return base;
  const allowed = base.filter((op) => isOperatorAllowedBySchema(field, op));
  return allowed.length > 0 ? allowed : base;
}

/** Why the runtime may reject an attribute condition, or `null`. Only when a master schema was loaded. */
export function schemaFieldNotice(c: FilterCondition, fields?: readonly MasterSchemaField[]): string | null {
  if (c.category !== 'attribute' || !fields) return null;
  const field = findSchemaField(fields, c.field.trim());
  if (!field) {
    return 'Not declared in the master schema. The runtime rejects it while schema filter enforcement is on.';
  }
  if (field.filterOperators.length === 0) {
    return 'Not filterable: the master schema declares no x-filterOperators for this field.';
  }
  if (!typeOperators(c).some((op) => isOperatorAllowedBySchema(field, op))) {
    return 'No operator for this value type is listed in x-filterOperators (the runtime expects runtime spellings such as gte, neq, contains).';
  }
  return null;
}

const INDEX_BACKED_OPERATORS: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  'gt', 'ge', 'lt', 'le', 'between', 'like', 'match', 'startswith', 'endswith', 'in', 'nin', 'isNull',
]);

/** True when the runtime reads the x-indexed projection for this operator (not for eq, ne, includes). */
export function usesIndexProjection(op: FilterOperator): boolean {
  return INDEX_BACKED_OPERATORS.has(op);
}

export interface AttributeSortOption {
  value: string;
  label: string;
  indexed: boolean;
}

export function sortableAttributeOptions(fields?: readonly MasterSchemaField[]): AttributeSortOption[] {
  return (fields ?? [])
    .filter((f) => f.sortable)
    .map((f) => ({ value: `attributes.${f.path}`, label: f.path, indexed: f.indexed }));
}

export function describeSchemaField(field: MasterSchemaField): string {
  const parts = [field.type];
  if (field.indexed) parts.push('IDX');
  if (field.filterOperators.length === 0) parts.push('not filterable');
  return parts.join(' · ');
}
