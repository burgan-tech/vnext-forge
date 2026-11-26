/**
 * The single catalog of what a Dynamic Expresso expression can reference: variables, functions, members,
 * JSON conversions and statics, per expression surface. Completions, highlighting and diagnostics read
 * it instead of keeping their own lists. Mirrors the runtime `ExpressionSignatures`.
 */
import {
  siteVariableNames,
  type MappingSiteKind,
} from '../save-component/declarative-mapping/declarativeMapping';
import type { ExpressionKind } from '../save-component/components/dynamicExpression';

export type BlockSurface = MappingSiteKind;
export type SlotSurface = 'condition' | 'value' | 'key' | 'timer' | 'string' | 'decision' | 'agentTool';
export type ExpressionSurface = BlockSurface | SlotSurface;
export type EntryKind = 'variable' | 'member' | 'field' | 'function' | 'conversion' | 'static';

export interface CatalogEntry {
  name: string;
  kind: EntryKind;
  signature?: string;
  description: string;
  /** Text inserted when it differs from `name`. */
  insertText?: string;
  /** Caret position within `insertText` (default: its end). */
  caretOffset?: number;
}

const entry = (
  name: string,
  kind: EntryKind,
  description: string,
  extra: Partial<CatalogEntry> = {},
): CatalogEntry => ({ name, kind, description, ...extra });

const variable = (name: string, description: string) => entry(name, 'variable', description);
const member = (name: string, description: string, kind: EntryKind = 'member') => entry(name, kind, description);

/* ────────────── Variables ────────────── */

const VARIABLES: Record<string, CatalogEntry> = {
  data: variable('data', 'The instance data (latest version).'),
  input: variable('input', 'The request or transition input.'),
  instance: variable('instance', 'Read-only view of the instance (camelCase members).'),
  now: variable('now', 'The current time (DateTime).'),
  user: variable('user', 'The calling user.'),
  context: variable('context', 'Legacy rule context (PascalCase members).'),
  headers: variable('headers', 'The incoming request headers, read-only: headers["x-channel"].'),
  task: variable('task', "The task's configuration (config fields)."),
  config: variable('config', 'Host configuration.'),
  result: variable('result', 'The task or SubFlow response.'),
  outcome: variable('outcome', 'The agent run outcome.'),
  candidates: variable('candidates', 'The candidate transition keys of the agent decision.'),
  args: variable('args', 'The arguments the agent passed to the tool.'),
};

const pick = (...keys: string[]) => keys.map((k) => VARIABLES[k]);
const SLOT_BASE = ['data', 'input', 'instance', 'now', 'user', 'context', 'headers'];

export function variablesOf(surface: ExpressionSurface): CatalogEntry[] {
  switch (surface) {
    case 'condition':
    case 'value':
    case 'key':
    case 'timer':
    case 'string':
      return pick(...SLOT_BASE);
    case 'decision':
      return pick(...SLOT_BASE, 'outcome', 'candidates');
    case 'agentTool':
      return pick('args', 'data', 'now');
    default:
      // Block sites; `urlEncode` is a function, not a variable.
      return pick(...siteVariableNames(surface).filter((n) => n !== 'urlEncode'));
  }
}

/* ────────────── Functions ────────────── */

const SHA256 = entry('sha256', 'function', 'SHA-256 hex of a string.', {
  signature: 'sha256(value)',
  insertText: 'sha256()',
  caretOffset: 7,
});
const VARY_KEY = entry('varyKey', 'function', 'The cache vary key of the request.', {
  signature: 'varyKey(context)',
  insertText: 'varyKey()',
  caretOffset: 8,
});
const URL_ENCODE_FN = entry('urlEncode', 'function', 'Percent-encodes one URL component.', {
  signature: 'urlEncode(value)',
  insertText: 'urlEncode()',
  caretOffset: 10,
});

const isTaskSurface = (surface: ExpressionSurface): boolean => surface === 'taskInput' || surface === 'taskOutput';

export function functionsOf(surface: ExpressionSurface): CatalogEntry[] {
  if (surface === 'value' || surface === 'key') return [SHA256, VARY_KEY];
  return isTaskSurface(surface) ? [URL_ENCODE_FN] : [];
}

/* ────────────── Conversions and statics ────────────── */

const CONVERSIONS: CatalogEntry[] = [
  entry('AsDouble()', 'conversion', 'JSON value as a double, for comparison and arithmetic.'),
  entry('AsInt32()', 'conversion', 'JSON value as a 32-bit integer.'),
  entry('AsBoolean()', 'conversion', 'JSON value as a boolean.'),
  entry('AsArrayLength()', 'conversion', 'Length of a JSON array.'),
  entry('AsJsonElement()', 'conversion', 'The raw JSON element.'),
];

export function conversionsOf(surface: ExpressionSurface): CatalogEntry[] {
  return surface === 'agentTool' ? [] : CONVERSIONS;
}

const STATICS: CatalogEntry[] = [
  entry('TimeSpan', 'static', 'Duration factory: TimeSpan.FromMinutes(15.0).'),
  entry('DateTime', 'static', 'Date-time type: DateTime.UtcNow.'),
];

export function staticsOf(surface: ExpressionSurface): CatalogEntry[] {
  return surface === 'timer' ? STATICS : [];
}

/* ────────────── Members ────────────── */

const INSTANCE: CatalogEntry[] = [
  member('id', 'Instance id.'),
  member('key', 'Instance key.'),
  member('flow', 'Flow (workflow) key.'),
  member('version', 'Workflow version.'),
  member('currentState', 'Current state key.'),
  member('effectiveState', 'State key after descending into SubFlows.'),
  member('effectiveStateType', 'State type of the effective state.'),
  member('effectiveStateSubType', 'State sub type of the effective state.'),
  member('effectiveStatus', 'Status of the effective state.'),
  member('type', 'Workflow type.'),
  member('data', 'Instance data.'),
];
const USER: CatalogEntry[] = [
  member('available', 'True when a caller is resolved.'),
  member('roles', 'The caller roles.'),
  member('hasRole("")', 'True when the caller has the role.'),
];
const HEADERS: CatalogEntry[] = [member('has("")', 'True when the request header is present.')];
const CONFIG: CatalogEntry[] = [member('get("")', 'Reads one host configuration value.')];
const TASK: CatalogEntry[] = [
  member('url', "The task's url.", 'field'),
  member('method', "The task's HTTP method.", 'field'),
  member('body', "The task's body.", 'field'),
  member('headers', "The task's configured outgoing headers.", 'field'),
  member('timeoutSeconds', "The task's timeout in seconds.", 'field'),
  member('queryString', "The task's query string.", 'field'),
  member('data', "The task's data (binding payload).", 'field'),
];
const TASK_RESULT: CatalogEntry[] = [
  member('body', 'Response body.'),
  member('headers', 'Response headers.'),
  member('statusCode', 'Response status code.'),
];
const SUBFLOW_RESULT: CatalogEntry[] = [
  member('data', "The child's data."),
  member('status', '"completed" or "faulted".'),
];
const OUTCOME: CatalogEntry[] = [
  member('completed', 'True when the run completed.'),
  member('output', 'The run output.'),
  member('text', 'The run output as text.'),
  member('decision', 'The decision the run produced.'),
  member('reason', 'The reason for the decision.'),
  member('failureReason', 'Why the run failed.'),
];
const CANDIDATES: CatalogEntry[] = [
  member('count', 'Number of candidates.'),
  member('keys', 'The candidate keys.'),
  member('has("")', 'True when the key is a candidate.'),
  member('find("")', 'The candidate with the key.'),
];
const CONTEXT: CatalogEntry[] = [
  member('Body', 'Request body.', 'field'),
  member('Headers', 'Request headers.', 'field'),
  member('QueryParameters', 'Request query parameters.', 'field'),
  member('RouteValues', 'Request route values.', 'field'),
  member('Instance', 'Instance view.', 'field'),
  member('Transition', 'Current transition.', 'field'),
  member('Workflow', 'Workflow definition.', 'field'),
  member('Runtime', 'Runtime information.', 'field'),
];

/** Members offered after `root.` on the surface; empty when the surface lacks the variable. */
export function membersOf(root: string, surface: ExpressionSurface): CatalogEntry[] {
  if (!variablesOf(surface).some((v) => v.name === root)) return [];
  switch (root) {
    case 'instance':
      return INSTANCE;
    case 'user':
      return USER;
    case 'headers':
      return HEADERS;
    case 'config':
      return isTaskSurface(surface) ? CONFIG : [];
    case 'task':
      return isTaskSurface(surface) ? TASK : [];
    case 'result':
      return surface === 'subFlowOutput' ? SUBFLOW_RESULT : TASK_RESULT;
    case 'outcome':
      return OUTCOME;
    case 'candidates':
      return CANDIDATES;
    case 'context':
      return CONTEXT;
    default:
      return [];
  }
}

/**
 * Describes `name`: a member of `root` first, else any conversion / function / static of the surface;
 * `root: null` looks up a root-level name (variable, function, static).
 */
export function describe(root: string | null, name: string, surface: ExpressionSurface): CatalogEntry | undefined {
  if (root === null) {
    return [...variablesOf(surface), ...functionsOf(surface), ...staticsOf(surface)].find((e) => e.name === name);
  }
  return (
    membersOf(root, surface).find((e) => e.name === name) ??
    [...conversionsOf(surface), ...functionsOf(surface), ...staticsOf(surface)].find((e) => e.name === name)
  );
}

export function slotSurfaceOf(kind: ExpressionKind): SlotSurface {
  return kind;
}
