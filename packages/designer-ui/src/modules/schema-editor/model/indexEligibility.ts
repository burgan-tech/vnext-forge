/**
 * Mirror of runtime `AttributeIndexDefinition.Visit`
 * (vnext/src/BBT.Workflow.Domain/Definitions/Schemas/AttributeIndexDefinition.cs).
 *
 * The runtime walks the schema with a `supported` flag and throws one generic
 * message on the first bad `x-indexed`. This walk is the same traversal, but it
 * records every object node with a single actionable reason, so the editor can
 * explain eligibility before save:
 *
 * - `supported` turns false below `$ref` / composition / conditional keywords
 *   (on the node itself or an ancestor), below every keyword that is not a
 *   fixed `properties` chain, below a non-object parent, and below a property
 *   name that contains a dot;
 * - the dotted path must match `^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$`
 *   (so the root, path `""`, is never indexable);
 * - `x-indexed: true` needs an explicit scalar `type`;
 * - outside `attributes.type === 'master'` any `x-indexed` is rejected.
 */
import { MASTER_SCHEMA_TYPE, readSchemaAttributesType } from '../SchemaEditorSchema';
import { appendPointer, ROOT_POINTER, type JsonPointer } from './jsonPointer';
import { getSchemaRoot } from './schemaNode';

export type IndexIneligibleReason =
  | 'notMaster'
  | 'root'
  | 'dynamicLocation'
  | 'composition'
  | 'parentNotObject'
  | 'invalidPath'
  | 'notScalar';

export type IndexViolationReason = IndexIneligibleReason | 'notBoolean';

export type IndexColumnType = 'text' | 'numeric' | 'timestamptz';

export const INDEX_MESSAGES: Record<IndexViolationReason, string> = {
  notMaster: 'x-indexed is only allowed when attributes.type is master.',
  notBoolean: 'x-indexed must be true or false.',
  root: 'The schema root cannot be indexed. Mark a field under properties instead.',
  dynamicLocation:
    'Only fields reached through nested properties can be indexed, not fields under items, $defs, patternProperties, additionalProperties or similar locations.',
  composition:
    'An indexed field and its parents cannot use $ref, allOf, anyOf, oneOf, not, if/then/else or dependentSchemas.',
  parentNotObject: 'The parent of an indexed field must be an object (type object or no type).',
  invalidPath:
    'Index paths start with a letter and use only letters, digits and underscores in every segment.',
  notScalar:
    'x-indexed needs an explicit scalar type: string, number, integer or boolean (dates are strings with format date-time).',
};

export interface IndexNodeInfo {
  pointer: JsonPointer;
  /** Dotted runtime path (`customer.name`); dynamic locations keep their parent path. */
  path: string;
  eligible: boolean;
  reason?: IndexIneligibleReason;
  /** Raw `x-indexed` value; `undefined` when the keyword is absent. */
  indexed: unknown;
}

export interface IndexViolation {
  pointer: JsonPointer;
  path: string;
  reason: IndexViolationReason;
  message: string;
}

export interface IndexTypeMismatch {
  schemaType: string | undefined;
  indexedPointers: JsonPointer[];
}

const COMPOSITION_KEYWORDS: ReadonlySet<string> = new Set([
  '$ref', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else', 'dependentSchemas',
]);
const DICTIONARY_KEYWORDS: ReadonlySet<string> = new Set([
  '$defs', 'definitions', 'patternProperties', 'dependentSchemas',
]);
const SUBSCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
  'items', 'prefixItems', '$defs', 'definitions', 'allOf', 'anyOf', 'oneOf', 'if', 'then', 'else',
  'additionalProperties', 'patternProperties', 'not', 'dependentSchemas', 'contains', 'propertyNames',
  'additionalItems', 'unevaluatedProperties', 'unevaluatedItems',
]);
const SCALAR_TYPES: ReadonlySet<string> = new Set(['string', 'number', 'integer', 'boolean']);
const INDEX_PATH = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function analyzeIndexEligibility(
  schemaRoot: unknown,
  schemaType: unknown,
): Map<JsonPointer, IndexNodeInfo> {
  const master = schemaType === MASTER_SCHEMA_TYPE;
  const result = new Map<JsonPointer, IndexNodeInfo>();

  const reasonFor = (
    node: Record<string, unknown>,
    pointer: JsonPointer,
    path: string,
    blocked: IndexIneligibleReason | null,
  ): IndexIneligibleReason | null => {
    if (!master) return 'notMaster';
    if (pointer === ROOT_POINTER) return 'root';
    if (blocked) return blocked;
    if (!INDEX_PATH.test(path)) return 'invalidPath';
    if (typeof node.type !== 'string' || !SCALAR_TYPES.has(node.type)) return 'notScalar';
    return null;
  };

  const visit = (
    value: unknown,
    pointer: JsonPointer,
    path: string,
    blocked: IndexIneligibleReason | null,
  ): void => {
    if (Array.isArray(value)) {
      (value as unknown[]).forEach((child, index) => {
        visit(child, appendPointer(pointer, index), path, blocked ?? 'dynamicLocation');
      });
      return;
    }
    if (!isRecord(value)) return;

    const nodeBlocked =
      blocked ?? (Object.keys(value).some((key) => COMPOSITION_KEYWORDS.has(key)) ? 'composition' : null);
    const reason = reasonFor(value, pointer, path, nodeBlocked);
    result.set(pointer, {
      pointer,
      path,
      eligible: reason === null,
      ...(reason ? { reason } : {}),
      indexed: value['x-indexed'],
    });

    for (const [keyword, child] of Object.entries(value)) {
      if (keyword === 'properties' && isRecord(child)) {
        const objectParent = !('type' in value) || value.type === 'object';
        for (const [name, propertySchema] of Object.entries(child)) {
          const childBlocked =
            nodeBlocked ?? (!objectParent ? 'parentNotObject' : name.includes('.') ? 'invalidPath' : null);
          visit(
            propertySchema,
            appendPointer(pointer, 'properties', name),
            path === '' ? name : `${path}.${name}`,
            childBlocked,
          );
        }
      } else if (SUBSCHEMA_KEYWORDS.has(keyword)) {
        const childBlocked = nodeBlocked ?? 'dynamicLocation';
        if (DICTIONARY_KEYWORDS.has(keyword) && isRecord(child)) {
          for (const [name, entry] of Object.entries(child)) {
            visit(entry, appendPointer(pointer, keyword, name), path, childBlocked);
          }
        } else {
          visit(child, appendPointer(pointer, keyword), path, childBlocked);
        }
      }
    }
  };

  visit(schemaRoot, ROOT_POINTER, '', null);
  return result;
}

const analysisCache = new WeakMap<object, Map<JsonPointer, IndexNodeInfo>>();

/** Analysis of a whole schema component (`attributes.schema` + `attributes.type`), cached per document object. */
export function getIndexAnalysis(
  componentJson: Record<string, unknown> | null | undefined,
): Map<JsonPointer, IndexNodeInfo> {
  if (!componentJson) return new Map();
  const cached = analysisCache.get(componentJson);
  if (cached) return cached;
  const analysis = analyzeIndexEligibility(getSchemaRoot(componentJson), readSchemaAttributesType(componentJson));
  analysisCache.set(componentJson, analysis);
  return analysis;
}

export function indexInfoAt(analysis: Map<JsonPointer, IndexNodeInfo>, pointer: JsonPointer): IndexNodeInfo {
  return (
    analysis.get(pointer) ?? { pointer, path: '', eligible: false, reason: 'dynamicLocation', indexed: undefined }
  );
}

export function indexViolationFor(info: IndexNodeInfo): IndexViolation | null {
  if (info.indexed === undefined) return null;
  const violation = (reason: IndexViolationReason): IndexViolation => ({
    pointer: info.pointer,
    path: info.path,
    reason,
    message: INDEX_MESSAGES[reason],
  });
  if (info.reason === 'notMaster') return violation('notMaster');
  if (typeof info.indexed !== 'boolean') return violation('notBoolean');
  if (info.indexed && !info.eligible) return violation(info.reason ?? 'dynamicLocation');
  return null;
}

export function findIndexViolations(analysis: Map<JsonPointer, IndexNodeInfo>): IndexViolation[] {
  const violations: IndexViolation[] = [];
  for (const info of analysis.values()) {
    const violation = indexViolationFor(info);
    if (violation) violations.push(violation);
  }
  return violations;
}

export function indexedPointers(analysis: Map<JsonPointer, IndexNodeInfo>): JsonPointer[] {
  return [...analysis.values()].filter((info) => info.indexed !== undefined).map((info) => info.pointer);
}

/** Columns the runtime projects for an indexed field (`AttributeIndexDefinition.From`). */
export function indexColumnsFor(node: Record<string, unknown> | null | undefined): IndexColumnType[] {
  if (!node) return [];
  const columns: IndexColumnType[] = ['text'];
  if (node.type === 'number' || node.type === 'integer') columns.push('numeric');
  if (node.type === 'string' && node.format === 'date-time') columns.push('timestamptz');
  return columns;
}

/** A schema that declares `x-indexed` anywhere while `attributes.type` is not `master`. */
export function indexTypeMismatch(
  componentJson: Record<string, unknown> | null | undefined,
): IndexTypeMismatch | null {
  const schemaType = readSchemaAttributesType(componentJson);
  if (schemaType === MASTER_SCHEMA_TYPE) return null;
  const pointers = indexedPointers(getIndexAnalysis(componentJson));
  return pointers.length > 0 ? { schemaType, indexedPointers: pointers } : null;
}
