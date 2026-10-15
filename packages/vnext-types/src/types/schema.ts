import { compareVersions } from '../utils/version';
import type { Label } from './label';

export interface SchemaDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  type?: string;
  labels?: Label[];
  tags?: string[];
  schema: Record<string, unknown>;
}

/**
 * `attributes.type` roles of a schema component (vnext-schema ≥ 0.0.56). The
 * role gates which `x-*` annotations the schema may carry; an absent or empty
 * type applies no role gate.
 */
export const SCHEMA_ROLES = ['master', 'transition', 'component', 'function'] as const;

export type SchemaRole = (typeof SCHEMA_ROLES)[number];

export function isSchemaRole(value: unknown): value is SchemaRole {
  return typeof value === 'string' && (SCHEMA_ROLES as readonly string[]).includes(value);
}

/** First vnext-schema release that restricts `attributes.type` to {@link SCHEMA_ROLES}. */
export const SCHEMA_ROLES_MIN_VERSION = '0.0.56';

/**
 * True when a pinned vnext-schema version enforces schema roles. An unknown or
 * unparseable pin validates against the bundled package (≥ 0.0.56), so it
 * counts as enforced.
 */
export function schemaRolesEnforced(schemaVersion: string | null | undefined): boolean {
  if (!schemaVersion || !/\d+\.\d+/.test(schemaVersion)) return true;
  return compareVersions(schemaVersion, SCHEMA_ROLES_MIN_VERSION) >= 0;
}

export type SchemaTypeClass =
  | { kind: 'none' }
  | { kind: 'role'; role: SchemaRole }
  | { kind: 'legacy'; value: string };

/** Absent or empty → `none`; a role → `role`; any other value → `legacy`. */
export function classifySchemaType(value: unknown): SchemaTypeClass {
  if (value === undefined || value === null || value === '') return { kind: 'none' };
  if (isSchemaRole(value)) return { kind: 'role', role: value };
  return { kind: 'legacy', value: typeof value === 'string' ? value : JSON.stringify(value) };
}
