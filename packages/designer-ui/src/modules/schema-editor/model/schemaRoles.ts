/**
 * Schema roles (`attributes.type`, vnext-schema ≥ 0.0.56) and the `x-*`
 * annotations each role's vocabulary accepts. Mirrors the `propertyNames`
 * gates in `record-vocab.json` (master), `input-vocab.json` (transition,
 * function) and `component-vocab.json` (component); an untyped schema accepts
 * every annotation except `x-indexed`.
 *
 * Pure module (no React, no store) so the matrix can be unit tested and shared
 * by the editor cards and the workspace diagnostics.
 */
import { SCHEMA_ROLES, classifySchemaType, type SchemaRole } from '@vnext-forge-studio/vnext-types';

export {
  SCHEMA_ROLES_MIN_VERSION,
  classifySchemaType,
  schemaRolesEnforced,
  type SchemaTypeClass,
} from '@vnext-forge-studio/vnext-types';

export interface SchemaRoleOption {
  role: SchemaRole;
  label: string;
  description: string;
}

export const SCHEMA_ROLE_OPTIONS: readonly SchemaRoleOption[] = [
  {
    role: 'master',
    label: 'Master',
    description: "The workflow's instance-data schema (the workflow's schema reference).",
  },
  { role: 'transition', label: 'Transition', description: 'The body of a transition or start request.' },
  { role: 'component', label: 'Component', description: "An embedded view's data schema." },
  { role: 'function', label: 'Function', description: "A function's input schema." },
];

/** Accepted by every role (base vocabulary + view hints). */
const BASE_KEYWORDS = [
  'x-conditional',
  'x-displayFormat',
  'x-enum',
  'x-errorMessages',
  'x-group',
  'x-helpText',
  'x-labels',
  'x-lookup',
  'x-lov',
  'x-order',
  'x-placeholder',
  'x-uiHint',
  'x-uiNote',
  'x-validation',
] as const;

const ROLE_KEYWORDS: Record<SchemaRole, ReadonlySet<string>> = {
  master: new Set([
    ...BASE_KEYWORDS,
    'x-computed',
    'x-context-target',
    'x-encryption',
    'x-filterOperators',
    'x-indexed',
    'x-masking',
    'x-roles',
    'x-sortable',
    'x-storage',
  ]),
  transition: new Set([...BASE_KEYWORDS, 'x-context-source', 'x-encryption']),
  function: new Set([...BASE_KEYWORDS, 'x-context-source', 'x-encryption']),
  component: new Set([...BASE_KEYWORDS, 'x-binding']),
};

/** Removed annotations every 0.0.56 role refuses (old spellings of x-storage / x-encryption). */
const REMOVED_KEYWORDS: Readonly<Record<string, string>> = {
  'x-persistance': 'x-persistance was removed; use x-storage on a master schema for file fields.',
  'x-encrypt': 'x-encrypt was removed; use x-encryption.',
};

/** Input roles accept only the client form of `x-encryption`. */
function isClientEncryption(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).source === 'client'
  );
}

/**
 * Whether `role` accepts `xKey`. `value` refines value-dependent rules
 * (`x-encryption` on input roles); without it the keyword itself is judged.
 * `undefined` role = untyped schema.
 */
export function roleAllowsKeyword(role: SchemaRole | undefined, xKey: string, value?: unknown): boolean {
  if (REMOVED_KEYWORDS[xKey]) return false;
  if (!role) return xKey !== 'x-indexed';
  if (!ROLE_KEYWORDS[role].has(xKey)) return false;
  if (xKey === 'x-encryption' && (role === 'transition' || role === 'function') && value !== undefined) {
    return isClientEncryption(value);
  }
  return true;
}

/** Roles that accept `xKey`, in display order. */
export function rolesAllowingKeyword(xKey: string): SchemaRole[] {
  return SCHEMA_ROLES.filter((role) => ROLE_KEYWORDS[role].has(xKey));
}

/**
 * Why `role` refuses `xKey` with `value`, or `null` when it is accepted.
 * Only meaningful for `x-*` keys.
 */
export function roleKeywordViolation(
  role: SchemaRole | undefined,
  xKey: string,
  value: unknown,
): string | null {
  if (roleAllowsKeyword(role, xKey, value)) return null;
  if (REMOVED_KEYWORDS[xKey]) return REMOVED_KEYWORDS[xKey];
  if (!role) return `${xKey} needs the master role.`;
  if (xKey === 'x-encryption' && ROLE_KEYWORDS[role].has(xKey)) {
    return `A ${role} schema accepts only client encryption (source: "client").`;
  }
  const allowed = rolesAllowingKeyword(xKey);
  return allowed.length > 0
    ? `${xKey} is not allowed on a ${role} schema. Allowed on: ${allowed.join(', ')}.`
    : `${xKey} is not allowed on a ${role} schema.`;
}

const SLOT_LABEL: Record<SchemaRole, string> = {
  master: "a workflow's master schema",
  transition: 'a transition body',
  function: "a function's input",
  component: "a view's data schema",
};

/**
 * Why a schema does not fit the slot it is referenced from (`expected`), or
 * `null` when it fits. Untyped schemas fit every slot; a legacy type fails
 * validation from 0.0.56 on.
 */
export function schemaRoleSlotMismatch(schemaType: unknown, expected: SchemaRole): string | null {
  const current = classifySchemaType(schemaType);
  if (current.kind === 'none') return null;
  if (current.kind === 'legacy') {
    return `Its attributes.type "${current.value}" is a legacy value; set it to ${expected} (used as ${SLOT_LABEL[expected]}).`;
  }
  if (current.role === expected) return null;
  return `It has the ${current.role} role but is used as ${SLOT_LABEL[expected]}; its annotations are checked against the ${current.role} vocabulary. Set it to ${expected} or use a separate schema.`;
}
