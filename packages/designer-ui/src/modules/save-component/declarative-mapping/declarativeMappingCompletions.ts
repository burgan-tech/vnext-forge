/**
 * Completion sources for the declarative mapping editor: write targets, read
 * paths and Dynamic Expresso expression members. Pure functions; the editor
 * feeds them the workflow master schema (`attributes.schema` component's
 * `attributes.schema`) when it is in the project.
 */
import { effectiveTaskSlot } from '../taskSlots';
import {
  EVENT_INPUT_ROOTS,
  isTaskSite,
  pathSegment,
  RESPONSE_ROOTS,
  siteVariableNames,
  SUBFLOW_INPUT_ROOTS,
  toSiteKind,
  type MappingPhase,
  type MappingSiteKind,
} from './declarativeMapping';

/** Owner facts completions need beyond the master schema. */
export interface CompletionContext {
  /** Function output: the response slots of the function's task entries (`result.<slot>`). */
  resultSlots?: readonly string[];
}

/**
 * The `result` slots of a function's task entries: `variableKey`, else the task key as a variable name
 * (runtime `OnExecuteTask.ResponseVariableKey`); entries without a task key are skipped, duplicates once.
 */
export function resultSlotsOf(tasks: readonly unknown[]): string[] {
  const slots: string[] = [];
  for (const entry of tasks) {
    const slot = effectiveTaskSlot(entry);
    if (slot && !slots.includes(slot)) slots.push(slot);
  }
  return slots;
}

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

/**
 * Common task `config` fields an input block writes. Any field of the task's own
 * `config` is a valid target; these are the usual ones across task types (Http:
 * url, method, body, headers, timeoutSeconds; DaprService: queryString; DaprBinding: data).
 */
export const INPUT_TARGETS = [
  '$.url',
  '$.method',
  '$.body',
  '$.headers',
  '$.timeoutSeconds',
  '$.queryString',
  '$.data',
] as const;

/** Members offered after `task.`: the same common `config` fields. */
export const TASK_MEMBERS = ['url', 'method', 'body', 'headers', 'timeoutSeconds', 'queryString', 'data'] as const;

/** Members of `config` (host configuration). */
export const CONFIG_MEMBERS = ['get("")'] as const;

/**
 * Members of `headers` (the incoming request's headers, read-only). A header is read with the indexer —
 * `headers["x-channel"]` (null when absent, case-insensitive) — so a hyphenated name works; `has` tests presence.
 * Not `task.headers`, which is the task's configured outgoing headers.
 */
export const HEADERS_MEMBERS = ['has("")'] as const;

/** `urlEncode(value)`: percent-encodes one URL component. */
export const URL_ENCODE = 'urlEncode()';

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

/** `result` members of a SubFlow output: the child's data and `"completed"` / `"faulted"`. */
export const SUBFLOW_RESULT_MEMBERS = ['data', 'status'] as const;

/** SubFlow input write targets: the child's start request (`{ attributes, headers, key, tags }`). */
export const SUBFLOW_INPUT_TARGETS = SUBFLOW_INPUT_ROOTS.map((r) => `$.${r}`);

/** Conversions a JSON value needs for comparison and arithmetic. */
export const JSON_CONVERSIONS = [
  'AsDouble()',
  'AsInt32()',
  'AsBoolean()',
  'AsArrayLength()',
] as const;

/**
 * Variables of a mapping expression per site (runtime `ExpressionSignatures.Mapping`):
 * task sites add `task`, `config` and `urlEncode`; `result` belongs to the task output and the SubFlow output.
 * A bare phase is a task binding's block.
 */
export function expressionVariables(phaseOrSite: MappingPhase | MappingSiteKind): string[] {
  const site = toSiteKind(phaseOrSite);
  if (site === 'eventInput' || site === 'workflowOutput' || site === 'functionOutput') {
    return [...siteVariableNames(site)];
  }
  if (isTaskSite(site)) {
    const base = ['data', 'input', 'instance', 'now', 'user', 'context', 'task', 'config', 'headers', URL_ENCODE];
    return site === 'taskOutput' ? [...base, 'result'] : base;
  }
  const base = ['data', 'input', 'instance', 'now', 'user', 'context', 'headers'];
  return site === 'subFlowOutput' ? [...base, 'result'] : base;
}

/**
 * Write targets (`into`, `set` keys):
 * - task output, transition output, SubFlow output: instance-data paths from the master schema (`$.customer.name`);
 * - task input: common fields of the task's `config` (`$.url`, `$.body`, `$.headers`, …);
 * - SubFlow input: the child's start request (`$.attributes`, `$.headers`, `$.key`, `$.tags`).
 */
export function writeTargetPaths(phaseOrSite: MappingPhase | MappingSiteKind, schemaRoot: unknown): string[] {
  const site = toSiteKind(phaseOrSite);
  if (site === 'taskInput') return [...INPUT_TARGETS];
  if (site === 'subFlowInput') return [...SUBFLOW_INPUT_TARGETS];
  if (site === 'eventInput') return EVENT_INPUT_ROOTS.map((r) => `$.${r}`);
  if (site === 'workflowOutput' || site === 'functionOutput') return RESPONSE_ROOTS.map((r) => `$.${r}`);
  return schemaProperties(schemaRoot).map((p) => toPath('$', p.segments));
}

/** Variable-prefixed read paths of a non-task site: `$.data.<schema>`, `$.input`, `$.instance.<member>`, `$.user.available`. */
function variableSelectPaths(schemaRoot: unknown): string[] {
  return [
    '$.data',
    ...schemaProperties(schemaRoot).map((p) => toPath('$.data', p.segments)),
    '$.input',
    ...INSTANCE_MEMBERS.map((m) => `$.instance.${m}`),
    '$.user.available',
  ];
}

/**
 * Read paths (`select`):
 * - task output: `result` members (the root `$` is `result`);
 * - SubFlow output: `result` = `{ data, status }` (default `$.data`);
 * - task input: a variable first — `$.data.<schema>`, `$.input`, `$.instance.<member>`, `$.task.<field>`,
 *   `$.user.available` (`config` and `headers` are not selectable: read a header with a set expression);
 * - transition output, SubFlow input: the same without `task`.
 */
export function selectPaths(
  phaseOrSite: MappingPhase | MappingSiteKind,
  schemaRoot: unknown,
  context: CompletionContext = {},
): string[] {
  const site = toSiteKind(phaseOrSite);
  if (site === 'eventInput') return ['$.input', '$.context'];
  if (site === 'functionOutput') {
    return (context.resultSlots ?? []).flatMap((slot) => {
      const base = `$${pathSegment(slot)}`;
      return [base, ...RESULT_MEMBERS.map((m) => `${base}.${m}`)];
    });
  }
  if (site === 'taskOutput') return ['$', ...RESULT_MEMBERS.map((m) => `$.${m}`)];
  if (site === 'subFlowOutput') return ['$.data', '$.status', '$'];
  if (site === 'taskInput') {
    return [
      '$.data',
      ...schemaProperties(schemaRoot).map((p) => toPath('$.data', p.segments)),
      '$.input',
      ...INSTANCE_MEMBERS.map((m) => `$.instance.${m}`),
      ...TASK_MEMBERS.map((m) => `$.task.${m}`),
      '$.user.available',
    ];
  }
  return variableSelectPaths(schemaRoot);
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
  phaseOrSite: MappingPhase | MappingSiteKind,
  token: ExpressionToken,
  schemaRoot: unknown,
  context: CompletionContext = {},
): string[] {
  const site = toSiteKind(phaseOrSite);
  const { chain, query } = token;
  if (chain.length === 0) return prefixFilter(expressionVariables(site), query);
  const [root, ...rest] = chain;
  // A variable the site does not have offers nothing (an event has no data / instance / user).
  if (!expressionVariables(site).includes(root)) return [];
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
      if (site === 'functionOutput') {
        if (rest.length === 0) return prefixFilter(context.resultSlots ?? [], query);
        if (rest.length === 1) return prefixFilter(RESULT_MEMBERS, query);
        return prefixFilter(JSON_CONVERSIONS, query);
      }
      if (site === 'subFlowOutput') {
        if (rest.length === 0) return prefixFilter(SUBFLOW_RESULT_MEMBERS, query);
        return prefixFilter(JSON_CONVERSIONS, query);
      }
      if (site !== 'taskOutput') return [];
      if (rest.length === 0) return prefixFilter(RESULT_MEMBERS, query);
      return prefixFilter(JSON_CONVERSIONS, query);
    case 'input':
      return prefixFilter(JSON_CONVERSIONS, query);
    case 'task':
      if (!isTaskSite(site)) return [];
      if (rest.length === 0) return prefixFilter([...TASK_MEMBERS, ...JSON_CONVERSIONS], query);
      return prefixFilter(JSON_CONVERSIONS, query);
    case 'config':
      if (!isTaskSite(site)) return [];
      return rest.length === 0 ? prefixFilter(CONFIG_MEMBERS, query) : [];
    case 'headers':
      return rest.length === 0 ? prefixFilter(HEADERS_MEMBERS, query) : [];
    default:
      return [];
  }
}

/**
 * Replaces the typed member with `item`; a `hasRole("")` / `get("")` / `has("")` caret lands inside the quotes, a
 * `urlEncode()` caret inside the parentheses.
 */
export function insertExpressionItem(
  text: string,
  token: ExpressionToken,
  caret: number,
  item: string,
): { text: string; caret: number } {
  const next = text.slice(0, token.start) + item + text.slice(caret);
  const inside = item.endsWith('("")')
    ? item.length - 2
    : item === URL_ENCODE
      ? item.length - 1
      : item.length;
  return { text: next, caret: token.start + inside };
}

/** Path suggestions for a typed path prefix (prefix matches first). */
export function filterPaths(paths: readonly string[], query: string, limit = 12): string[] {
  return prefixFilter(paths, query, limit);
}
