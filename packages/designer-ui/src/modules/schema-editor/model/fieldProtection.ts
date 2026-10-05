/**
 * Design-time mirror of the runtime's publish rules for the field-protection
 * keywords (runtime 0.0.99 `FieldMaskingDefinition`, vnext
 * `docs/domain/field-masking.md`):
 *
 * - `x-masking` / `x-encryption` sit on a field reached through nested
 *   `properties` only — not the root, `items`, `$defs`, combinators or
 *   conditionals;
 * - the field is `type: "string"` (or `["string", "null"]`);
 * - one transform per field: no `x-masking` next to an active `x-encryption`;
 * - `hash` takes no `pattern`, `format`, `minLength`, `maxLength`, `enum`
 *   or `const`;
 * - neither combines with `x-filterOperators`, `x-sortable` or `x-indexed`.
 *
 * Exemption-list shape (allow-only plain roles) is enforced by the editor.
 */
import { MASTER_SCHEMA_TYPE } from '../SchemaEditorSchema';
import { analyzeIndexEligibility } from './indexEligibility';
import { type JsonPointer } from './jsonPointer';
import { getNodeAt, getSchemaRoot } from './schemaNode';

export type ProtectionKeyword = 'x-masking' | 'x-encryption';

const LOCATION_REASONS = new Set(['root', 'dynamicLocation', 'composition', 'parentNotObject']);
const HASH_FORBIDDEN = ['pattern', 'format', 'minLength', 'maxLength', 'enum', 'const'] as const;
const QUERY_KEYWORDS = ['x-filterOperators', 'x-sortable', 'x-indexed'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringType(type: unknown): boolean {
  if (type === 'string') return true;
  return (
    Array.isArray(type) &&
    type.includes('string') &&
    type.every((t) => t === 'string' || t === 'null')
  );
}

/** `x-encryption` type when it transforms the value (`hash` / `encrypt`), else null. */
export function activeEncryptionType(node: Record<string, unknown> | null | undefined): 'hash' | 'encrypt' | null {
  const enc = node?.['x-encryption'];
  const type = isRecord(enc) ? enc.type : undefined;
  return type === 'hash' || type === 'encrypt' ? type : null;
}

/**
 * Why the runtime would reject `keyword` on the node at `pointer`; empty when
 * it is fine or the keyword is absent. `x-encryption: none` is metadata only
 * and only the location rule applies to it.
 */
export function fieldProtectionIssues(
  componentJson: Record<string, unknown> | null | undefined,
  pointer: JsonPointer,
  keyword: ProtectionKeyword,
): string[] {
  if (!componentJson) return [];
  const node = getNodeAt(componentJson, pointer);
  if (!node || node[keyword] === undefined) return [];
  const issues: string[] = [];

  // Location: same traversal as x-indexed, minus the master / scalar rules.
  const info = analyzeIndexEligibility(getSchemaRoot(componentJson), MASTER_SCHEMA_TYPE).get(pointer);
  if (!info || (info.reason && LOCATION_REASONS.has(info.reason))) {
    issues.push(
      `${keyword} must be on a field reached through nested properties — not the root, items, $defs, combinators or conditionals.`,
    );
  }

  const encryption = activeEncryptionType(node);
  const transforms = keyword === 'x-masking' || encryption !== null;
  if (!transforms) return issues;

  if (!isStringType(node.type)) {
    issues.push(`${keyword} needs type "string" (or ["string", "null"]).`);
  }
  if (node['x-masking'] !== undefined && encryption !== null) {
    issues.push('One transform per field: remove x-masking or set x-encryption type to none.');
  }
  if (keyword === 'x-encryption' && encryption === 'hash') {
    const present = HASH_FORBIDDEN.filter((k) => node[k] !== undefined);
    if (present.length > 0) {
      issues.push(`A hashed value cannot also declare ${present.join(', ')} (the stored digest would never match).`);
    }
  }
  const query = QUERY_KEYWORDS.filter((k) => node[k] !== undefined && node[k] !== false);
  if (query.length > 0) {
    issues.push(`${keyword} cannot be combined with ${query.join(', ')}.`);
  }
  return issues;
}
