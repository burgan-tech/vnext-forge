import { Label } from './label';
import { MappingCode } from './mapping';
import { ResourceReference, TaskExecution } from './state';

export type FunctionScope = 'I' | 'F' | 'D';

/**
 * HTTP verbs a function may declare support for via `attributes.verbs`.
 *
 * Deliberately excludes `PUT` and `QUERY`: the engine contract only
 * recognizes these four, and `QUERY` is omitted on purpose because
 * OpenAPI generation, gateways and client SDKs cannot handle an
 * unrecognized method — body-carrying reads are modelled as `POST`.
 *
 * Declaration order here is the canonical serialization order.
 */
export const FUNCTION_VERBS = ['GET', 'POST', 'PATCH', 'DELETE'] as const;

export type FunctionVerb = (typeof FUNCTION_VERBS)[number];

/**
 * The `{ ref: './some-file.json' }` half of the engine's `componentRef`
 * union — a file-relative pointer instead of an explicit key/domain/
 * flow/version reference.
 */
export interface ComponentFileRef {
  ref: string;
}

export type FunctionComponentRef = ResourceReference | ComponentFileRef;

/**
 * One entry of a rule-based `inputView` / `outputView` slot. Entries are
 * evaluated in declaration order and the first match wins; an entry
 * without a `rule` always matches, so it must be last.
 *
 * Note there is no `extensions` field: that applies only to state and
 * transition views, and the engine rejects it on a function view.
 */
export interface FunctionViewRuleEntry {
  rule?: MappingCode;
  view: FunctionComponentRef;
  loadData?: boolean;
}

/** Rule-based `inputSchema` / `outputSchema` entry. Same ordering semantics. */
export interface FunctionSchemaRuleEntry {
  rule?: MappingCode;
  schema: FunctionComponentRef;
}

/**
 * A function's view contract: a single `sys-views` reference, a bare
 * array of rule entries, or the `{ views: [...] }` wrapper. All three
 * are accepted on the wire.
 */
export type FunctionViewSlot =
  | FunctionComponentRef
  | FunctionViewRuleEntry[]
  | { views: FunctionViewRuleEntry[] };

/** A function's schema contract. Mirrors {@link FunctionViewSlot}. */
export type FunctionSchemaSlot =
  | FunctionComponentRef
  | FunctionSchemaRuleEntry[]
  | { schemas: FunctionSchemaRuleEntry[] };

export interface FunctionDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  scope?: FunctionScope;
  labels?: Label[];
  tasks?: TaskExecution[];
  mapping?: MappingCode;
  extensions?: ResourceReference[];
}
