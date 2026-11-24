/**
 * Completion sources for the declarative mapping editor: write targets, read
 * paths and Dynamic Expresso expression members. Pure functions; the editor
 * feeds them the workflow master schema (`attributes.schema` component's
 * `attributes.schema`) when it is in the project.
 */
import { pathSegment, type MappingPhase } from './declarativeMapping';

const MAX_PATHS = 400;
const MAX_DEPTH = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** One master schema property: its JSON path segments and JSON Schema type. */
export interface SchemaProperty {
  segments: string[];
  type?: string;
}

/** Every master schema property in schema order (nested objects; arrays are leaves). */
export function schemaProperties(schemaRoot: unknown): SchemaProperty[] {
  const out: SchemaProperty[] = [];
  const walk = (node: Record<string, unknown>, segments: string[], depth: number) => {
    if (depth > MAX_DEPTH || out.length >= MAX_PATHS || !isRecord(node.properties)) return;
    for (const [name, child] of Object.entries(node.properties)) {
      if (out.length >= MAX_PATHS) return;
      const next = [...segments, name];
      const type = isRecord(child) && typeof child.type === 'string' ? child.type : undefined;
      out.push({ segments: next, ...(type ? { type } : {}) });
      if (isRecord(child) && isRecord(child.properties)) walk(child, next, depth + 1);
    }
  };
  if (isRecord(schemaRoot)) walk(schemaRoot, [], 0);
  return out;
}

function toPath(root: string, segments: readonly string[]): string {
  return root + segments.map(pathSegment).join('');
}

/** Request surfaces an input block writes. `$.route` is not offered: the runtime rejects it. */
export const INPUT_SURFACES = ['$.body', '$.headers', '$.query'] as const;

/** Members of the `instance` view (camelCase, read-only). */
export const INSTANCE_MEMBERS = [
  'id',
  'key',
  'flow',
  'version',
  'currentState',
  'effectiveState',
  'effectiveStateType',
  'effectiveStateSubType',
  'effectiveStatus',
  'type',
  'data',
] as const;

/** Members of `user`. `hasRole` takes a role name. */
export const USER_MEMBERS = ['available', 'roles', 'hasRole("")'] as const;

/** `result` members (output phase only): the task's standard response. */
export const RESULT_MEMBERS = ['body', 'headers', 'statusCode'] as const;

/** Conversions a JSON value needs for comparison and arithmetic. */
export const JSON_CONVERSIONS = [
  'AsDouble()',
  'AsInt32()',
  'AsBoolean()',
  'AsArrayLength()',
] as const;

/** Variables of a mapping expression; `result` only in the output phase. */
export function expressionVariables(phase: MappingPhase): string[] {
  const base = ['data', 'input', 'instance', 'now', 'user', 'context'];
  return phase === 'output' ? [...base, 'result'] : base;
}

/**
 * Write targets (`into`, `set` keys):
 * - output: instance-data paths from the master schema (`$.customer.name`);
 * - input: the request surfaces `$.body`, `$.headers`, `$.query`.
 */
export function writeTargetPaths(phase: MappingPhase, schemaRoot: unknown): string[] {
  if (phase === 'input') return [...INPUT_SURFACES];
  return schemaProperties(schemaRoot).map((p) => toPath('$', p.segments));
}

/**
 * Read paths (`select`):
 * - output: `result` members (the root `$` is `result`);
 * - input: a variable first — `$.data.<schema>`, `$.input`, `$.instance.<member>`, `$.user.available`.
 */
export function selectPaths(phase: MappingPhase, schemaRoot: unknown): string[] {
  if (phase === 'output') return ['$', ...RESULT_MEMBERS.map((m) => `$.${m}`)];
  return [
    '$.data',
    ...schemaProperties(schemaRoot).map((p) => toPath('$.data', p.segments)),
    '$.input',
    ...INSTANCE_MEMBERS.map((m) => `$.instance.${m}`),
    '$.user.available',
  ];
}

/* ────────────── Expressions ────────────── */

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface ExpressionToken {
  /** Where the replaced text starts (the last member name being typed). */
  start: number;
  /** The text typed so far for that member. */
  query: string;
  /** Members before it, from the variable (`['data', 'customer']` for `data.customer.na`). */
  chain: string[];
}

/**
 * The member chain being typed at the caret: `data.customer.na|` →
 * `{ chain: ['data', 'customer'], query: 'na' }`. `null` inside a string
 * literal or right after a call / index (`hasRole("x").`).
 */
export function expressionTokenAt(text: string, caret: number): ExpressionToken | null {
  const before = text.slice(0, caret);
  const quotes = (before.match(/(?<!\\)"/g) ?? []).length;
  if (quotes % 2 === 1) return null;
  const match = /(?:[A-Za-z_][A-Za-z0-9_]*\??\.)*[A-Za-z_]?[A-Za-z0-9_]*$/.exec(before);
  if (!match) return null;
  const raw = match[0];
  const preceding = before.slice(0, before.length - raw.length);
  if (/[A-Za-z0-9_)\]."]$/.test(preceding)) return null;
  const parts = raw.split('.').map((p) => p.replace(/\?$/, ''));
  const query = parts.pop() ?? '';
  return { start: caret - query.length, query, chain: parts };
}

function prefixFilter(items: readonly string[], query: string, limit = 12): string[] {
  const q = query.toLowerCase();
  const starts = items.filter((i) => i.toLowerCase().startsWith(q));
  const contains = q
    ? items.filter((i) => !i.toLowerCase().startsWith(q) && i.toLowerCase().includes(q))
    : [];
  return [...new Set([...starts, ...contains])].slice(0, limit);
}

/** Child property names of the schema node at `segments` (identifier-safe names only). */
function schemaChildren(
  properties: readonly SchemaProperty[],
  segments: readonly string[],
): SchemaProperty[] {
  return properties.filter(
    (p) =>
      p.segments.length === segments.length + 1 &&
      segments.every((s, i) => p.segments[i] === s) &&
      IDENTIFIER.test(p.segments[p.segments.length - 1]),
  );
}

/**
 * Suggestions for the member being typed in an expression:
 * variables at the root; `instance` / `user` / `result` members; master
 * schema children under `data` and `instance.data`; and the JSON
 * conversions (`AsDouble()`, …) after any JSON value.
 */
export function expressionSuggestions(
  phase: MappingPhase,
  token: ExpressionToken,
  schemaRoot: unknown,
): string[] {
  const { chain, query } = token;
  if (chain.length === 0) return prefixFilter(expressionVariables(phase), query);
  const [root, ...rest] = chain;
  const properties = schemaProperties(schemaRoot);
  const dataChildren = (segments: string[]) => {
    const children = schemaChildren(properties, segments).map(
      (p) => p.segments[p.segments.length - 1],
    );
    return segments.length === 0 ? children : [...children, ...JSON_CONVERSIONS];
  };
  switch (root) {
    case 'data':
      return prefixFilter(dataChildren(rest), query);
    case 'instance':
      if (rest.length === 0) return prefixFilter(INSTANCE_MEMBERS, query);
      if (rest[0] === 'data') return prefixFilter(dataChildren(rest.slice(1)), query);
      return [];
    case 'user':
      return rest.length === 0 ? prefixFilter(USER_MEMBERS, query) : [];
    case 'result':
      if (phase !== 'output') return [];
      if (rest.length === 0) return prefixFilter(RESULT_MEMBERS, query);
      return prefixFilter(JSON_CONVERSIONS, query);
    case 'input':
      return prefixFilter(JSON_CONVERSIONS, query);
    default:
      return [];
  }
}

/** Replaces the typed member with `item`; a `hasRole("")` caret lands inside the quotes. */
export function insertExpressionItem(
  text: string,
  token: ExpressionToken,
  caret: number,
  item: string,
): { text: string; caret: number } {
  const next = text.slice(0, token.start) + item + text.slice(caret);
  const inside = item.endsWith('("")') ? item.length - 2 : item.length;
  return { text: next, caret: token.start + inside };
}

/** Path suggestions for a typed path prefix (prefix matches first). */
export function filterPaths(paths: readonly string[], query: string, limit = 12): string[] {
  return prefixFilter(paths, query, limit);
}
