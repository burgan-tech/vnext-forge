/**
 * Declarative task mappings (runtime vnext#1229, `docs/runtime/declarative-task-mappings.md`).
 *
 * A task binding (`onExecuteTask`: state `onEntries` / `onExits`, transition
 * `onExecutionTasks`, function `task` / `tasks`, extension `task`) may carry
 * `input` / `output` blocks instead of a C# `mapping`:
 *
 * ```json
 * "input":  { "select": "$.data.customer", "into": "$.body.customer", "set": { "$.body.id": "data.customer.id" } },
 * "output": { "select": "$.body.score", "into": "$.kyc.score", "set": { "$.kyc.checkedAt": "now" } }
 * ```
 *
 * `mapping` and the blocks are mutually exclusive. The key order of `set` is
 * semantic (entries run in declaration order, a later entry wins), so every
 * edit here keeps it.
 *
 * Everything in this file is pure: the editor components and the tests share it.
 */

export type MappingPhase = 'input' | 'output';

/**
 * Where a block sits (runtime `DeclarativeSiteKind`). Task bindings carry
 * `taskInput` / `taskOutput`; a transition carries `transitionOutput` only; a
 * SubFlow (`type: S`) state carries `subFlowInput` / `subFlowOutput`
 * (runtime `docs/runtime/declarative-task-mappings.md` § Blocks outside task bindings).
 */
export type MappingSiteKind =
  | 'taskInput'
  | 'taskOutput'
  | 'transitionOutput'
  | 'subFlowInput'
  | 'subFlowOutput'
  | 'eventInput'
  | 'workflowOutput'
  | 'functionOutput';

/**
 * The object that holds the blocks: a task binding, a transition, a state's `subFlow`, an `event`
 * (workflow or transition; `mapping` script or `input` block), or the `attributes` of a workflow /
 * function whose `output` member holds a script OR a block.
 */
export type MappingOwnerKind = 'task' | 'transition' | 'subFlow' | 'event' | 'workflowOutput' | 'functionOutput';

/** Owners whose `output` member is either a script (`location` / `code`) or a block — never both. */
export function isOutputMemberOwner(owner: MappingOwnerKind): owner is 'workflowOutput' | 'functionOutput' {
  return owner === 'workflowOutput' || owner === 'functionOutput';
}

/** A bare phase means a task binding's block (the editor's original API). */
export function toSiteKind(phaseOrSite: MappingPhase | MappingSiteKind): MappingSiteKind {
  if (phaseOrSite === 'input') return 'taskInput';
  if (phaseOrSite === 'output') return 'taskOutput';
  return phaseOrSite;
}

export function siteKindOf(owner: MappingOwnerKind, phase: MappingPhase): MappingSiteKind {
  if (owner === 'transition') return 'transitionOutput';
  if (owner === 'event') return 'eventInput';
  if (owner === 'workflowOutput' || owner === 'functionOutput') return owner;
  if (owner === 'subFlow') return phase === 'input' ? 'subFlowInput' : 'subFlowOutput';
  return phase === 'input' ? 'taskInput' : 'taskOutput';
}

/** The blocks an owner takes: a transition is a single-block (`output`) site. */
export function ownerPhases(owner: MappingOwnerKind): MappingPhase[] {
  if (owner === 'event') return ['input'];
  if (owner === 'transition' || isOutputMemberOwner(owner)) return ['output'];
  return ['input', 'output'];
}

/** The block member a site lives in. */
export function sitePhase(site: MappingSiteKind): MappingPhase {
  return site === 'taskInput' || site === 'subFlowInput' || site === 'eventInput' ? 'input' : 'output';
}

/**
 * Sites whose `select` reads `result` (task output: the task response; SubFlow output: `{ data, status }`;
 * function output: `{ <variableKey>: { body, headers, statusCode } }`).
 */
export function siteReadsResult(site: MappingSiteKind): boolean {
  return site === 'taskOutput' || site === 'subFlowOutput' || site === 'functionOutput';
}

/**
 * Sites with no default source: `select` and `into` come together (runtime `DeclarativeMappingPlan.Build`).
 * A task input and a transition output have their own one-sided rules.
 */
export function sitePairsSelectInto(site: MappingSiteKind): boolean {
  return site === 'subFlowInput' || site === 'eventInput' || site === 'workflowOutput' || site === 'functionOutput';
}

/** The variables a site's expressions see (runtime `ExpressionSignatures.Mapping`), `headers` included. */
export function siteVariableNames(site: MappingSiteKind): readonly string[] {
  switch (site) {
    case 'eventInput':
      return EVENT_VARIABLES;
    case 'functionOutput':
      return ['data', 'input', 'instance', 'now', 'context', 'headers', 'result'];
    case 'workflowOutput':
    case 'transitionOutput':
    case 'subFlowInput':
      return [...VARIABLE_SELECT_ROOTS, 'headers'];
    case 'subFlowOutput':
      return [...VARIABLE_SELECT_ROOTS, 'headers', 'result'];
    case 'taskInput':
      return [...VARIABLE_SELECT_ROOTS, 'task', 'config', 'headers', 'urlEncode'];
    case 'taskOutput':
      return [...VARIABLE_SELECT_ROOTS, 'task', 'config', 'headers', 'urlEncode', 'result'];
  }
}

/** An event mapping's variables: the payload, the clock, the rule context and the event headers. */
export const EVENT_VARIABLES = ['input', 'now', 'context', 'headers'] as const;

/** Task sites have `task`, `config` and `urlEncode`; the others do not. */
export function isTaskSite(site: MappingSiteKind): boolean {
  return site === 'taskInput' || site === 'taskOutput';
}

export interface MappingBlock {
  select?: string;
  into?: string;
  set?: Record<string, string>;
}

/** The binding members this module reads and writes; the rest is left alone. */
export interface MappingBindingLike {
  mapping?: unknown;
  input?: unknown;
  output?: unknown;
  [member: string]: unknown;
}

export type BindingMappingMode = 'script' | 'declarative';

/**
 * What the binding holds today:
 * - `script`: a C# `mapping` only;
 * - `declarative`: an `input` and/or `output` block only;
 * - `both`: legacy binding stored with both (publish rejects it; the runtime
 *   runs the script and ignores the blocks);
 * - `empty`: neither (a new binding).
 */
export type BindingMappingContent = 'script' | 'declarative' | 'both' | 'empty';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasScriptMapping(binding: MappingBindingLike | null | undefined): boolean {
  return binding?.mapping !== undefined && binding?.mapping !== null;
}

export function hasDeclarativeBlocks(binding: MappingBindingLike | null | undefined): boolean {
  return (
    (binding?.input !== undefined && binding?.input !== null) ||
    (binding?.output !== undefined && binding?.output !== null)
  );
}

export function bindingMappingContent(
  binding: MappingBindingLike | null | undefined,
): BindingMappingContent {
  const script = hasScriptMapping(binding);
  const blocks = hasDeclarativeBlocks(binding);
  if (script && blocks) return 'both';
  if (script) return 'script';
  if (blocks) return 'declarative';
  return 'empty';
}

/**
 * Editor mode for a binding: what it holds wins; an empty binding takes the
 * author's last choice, declarative by default. A `both` binding opens in
 * script mode — that is what the runtime runs.
 */
export function resolveMappingMode(
  binding: MappingBindingLike | null | undefined,
  preferred: BindingMappingMode = 'declarative',
): BindingMappingMode {
  const content = bindingMappingContent(binding);
  if (content === 'script' || content === 'both') return 'script';
  if (content === 'declarative') return 'declarative';
  return preferred;
}

/** A block as stored, or `undefined` when absent or not an object. */
export function readMappingBlock(
  binding: MappingBindingLike | null | undefined,
  phase: MappingPhase,
): MappingBlock | undefined {
  const block = binding?.[phase];
  return isRecord(block) ? (block as MappingBlock) : undefined;
}

/* ────────────── Paths ────────────── */

/*
 * Mirrors of the vnext-schema patterns (`mappingReadPath`, `mappingWritePath`,
 * `mappingInputWritePath`) which in turn mirror the runtime's `JsonPath`
 * subset: `$`, `.name` (hyphens allowed), `['name']`, `[n]` / `[*]` read-only.
 */
const DOT_SEGMENT = String.raw`\.[^.\[\]'"\s]+`;
const QUOTED_SEGMENT = String.raw`\['(?:[^'\\]|\\['\\])*'\]`;
const INDEX_SEGMENT = String.raw`\[(?:[0-9]+|\*)\]`;

const READ_PATH = new RegExp(`^\\$(?:${DOT_SEGMENT}|${QUOTED_SEGMENT}|${INDEX_SEGMENT})*$`);
const WRITE_PATH = new RegExp(`^\\$(?:${DOT_SEGMENT}|${QUOTED_SEGMENT})+$`);

export const PATH_MAX_LENGTH = 1000;
export const EXPRESSION_MAX_LENGTH = 8000;

export function isReadPath(path: string): boolean {
  return path.length <= PATH_MAX_LENGTH && READ_PATH.test(path);
}

/** Instance-data write target (output `into` / `set` key): no index, no wildcard, not the root. */
export function isWritePath(path: string): boolean {
  return path.length <= PATH_MAX_LENGTH && WRITE_PATH.test(path);
}

/**
 * Task-config write target (input `into` / `set` key): a field of the task's own
 * `config` as authored in the task definition (`$.url`, `$.body.customer`,
 * `$.headers.x-channel`, `$.queryString`). Same shape as an output target
 * (`mappingInputWritePath`): the field set belongs to the task type, so a field
 * name is not checked here or at publish.
 */
export function isInputWritePath(path: string): boolean {
  return isWritePath(path);
}

const CONFIG_SELECT = /^\$(?:\.config|\['config'\])(?:[.[]|$)/;
const HEADERS_SELECT = /^\$(?:\.headers|\['headers'\])(?:[.[]|$)/;

/** The first segment of a path (`data` for `$.data.x`, `''` for `$`); `undefined` when it does not parse. */
export function firstPathSegment(path: string): string | undefined {
  if (!isReadPath(path)) return undefined;
  if (path === '$') return '';
  const m = /^\$(?:\.([^.[\]'"\s]+)|\['((?:[^'\\]|\\['\\])*)'\]|\[(?:[0-9]+|\*)\])/.exec(path);
  if (!m) return undefined;
  if (m[1] !== undefined) return m[1];
  if (m[2] !== undefined) return m[2].replace(/\\(['\\])/g, '$1');
  return '';
}

/** Whether `path` is its first member as a whole (`$.key`, not `$.key.x`). */
function isWholeMember(path: string): boolean {
  const first = firstPathSegment(path);
  return first !== undefined && (path === `$.${first}` || path === `$['${first}']`);
}

/**
 * The variables a variable-prefixed `select` starts at outside task bindings
 * (transition output, SubFlow input): every JSON-shaped variable of the site —
 * not `headers` (runtime `DeclarativeMappingPlan.IsSelectable`).
 */
export const VARIABLE_SELECT_ROOTS = ['data', 'input', 'instance', 'now', 'user', 'context'] as const;

/** The members a SubFlow input writes: the child's start request (`DeclarativeMappingPlan.SubFlowInputRoots`). */
export const SUBFLOW_INPUT_ROOTS = ['attributes', 'headers', 'key', 'tags'] as const;

/** The members an event input writes (`DeclarativeMappingPlan.EventInputRoots`); `$.key` only as a whole. */
export const EVENT_INPUT_ROOTS = ['key', 'attributes'] as const;

/** The members a workflow / function output writes (`DeclarativeMappingPlan.ResponseRoots`); `$.statusCode` only as a whole. */
export const RESPONSE_ROOTS = ['data', 'statusCode', 'headers'] as const;

/** The members whose target must be written whole, per document site. */
const WHOLE_MEMBERS: Partial<Record<MappingSiteKind, readonly string[]>> = {
  subFlowInput: ['key', 'tags'],
  eventInput: ['key'],
  workflowOutput: ['statusCode'],
  functionOutput: ['statusCode'],
};

/** The document members a site writes; `undefined` for an instance-data / task-config site. */
function documentRoots(site: MappingSiteKind): readonly string[] | undefined {
  if (site === 'subFlowInput') return SUBFLOW_INPUT_ROOTS;
  if (site === 'eventInput') return EVENT_INPUT_ROOTS;
  if (site === 'workflowOutput' || site === 'functionOutput') return RESPONSE_ROOTS;
  return undefined;
}

const DOCUMENT_NOUN: Partial<Record<MappingSiteKind, string>> = {
  subFlowInput: 'the start request',
  eventInput: 'the event mapping',
  workflowOutput: 'the response',
  functionOutput: 'the response',
};

/** The target document as it qualifies a path in the select / into pairing message ("naming the {noun} path"). */
const PATH_NOUN: Partial<Record<MappingSiteKind, string>> = {
  subFlowInput: 'start-request',
  eventInput: 'event mapping',
  workflowOutput: 'response',
  functionOutput: 'response',
};

/** SubFlow input target: a member of the start request; `$.key` / `$.tags` only as a whole. */
export function isSubFlowInputWritePath(path: string): boolean {
  if (!isWritePath(path)) return false;
  const first = firstPathSegment(path) ?? '';
  if (!(SUBFLOW_INPUT_ROOTS as readonly string[]).includes(first)) return false;
  return (first !== 'key' && first !== 'tags') || isWholeMember(path);
}

const PLAIN_NAME = /^[^.[\]'"\s]+$/;

/** One path segment for `name`: `.name` when it can be written that way, else `['name']`. */
export function pathSegment(name: string): string {
  return PLAIN_NAME.test(name)
    ? `.${name}`
    : `['${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`;
}

/* ────────────── Validation ────────────── */

export interface MappingIssue {
  /** `select`, `into`, `set`, or `set['<key>']`. */
  field: string;
  message: string;
  severity: 'error' | 'warning';
  /** For a `set` entry: whether the key (target) or the expression is at fault. */
  part?: 'target' | 'expression';
}

/** Assignment operators are disabled in mapping expressions (`AssignmentOperators.None`). */
function containsAssignment(expression: string): boolean {
  // Strip string and char literals first so `"a=b"` does not count.
  const code = expression.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  return /(^|[^=!<>])=(?!=)/.test(code) || /(\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=)/.test(code);
}

const PASCAL_INSTANCE_MEMBER = /\binstance\.([A-Z][A-Za-z]*)/;
const PASCAL_USER_MEMBER = /\buser\.(Available|Roles|HasRole)\b/;

/** Root identifiers an expression uses (`result` in `result.data`, not in `data.result` or `"result"`). */
function usesRootIdentifier(expression: string, name: string): boolean {
  const code = expression.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  return new RegExp(`(?<![.\\w])${name}\\b`).test(code);
}

const WRITE_HINTS: Record<MappingSiteKind, string> = {
  taskInput:
    "a field of the task's config ($.url, $.body.x, $.headers.x-channel, $.timeoutSeconds), then .name / ['name'] segments",
  taskOutput:
    "an instance-data path: $ then .name / ['name'] segments (no index, no wildcard, not the root)",
  transitionOutput:
    "an instance-data path: $ then .name / ['name'] segments (no index, no wildcard, not the root)",
  subFlowInput:
    "a member of the child's start request: $.attributes.x, $.headers.x, $.key or $.tags (no index, no wildcard)",
  subFlowOutput:
    "an instance-data path: $ then .name / ['name'] segments (no index, no wildcard, not the root)",
  eventInput: 'a member of the event mapping: $.key or $.attributes.x (no index, no wildcard)',
  workflowOutput: 'a member of the response: $.data.x, $.statusCode or $.headers.x (no index, no wildcard)',
  functionOutput: 'a member of the response: $.data.x, $.statusCode or $.headers.x (no index, no wildcard)',
};

/** Publish error for a function output that reads `user` (runtime `MappingBlockValidator.FunctionOutputNoCallerError`). */
export const FUNCTION_OUTPUT_NO_CALLER =
  'function output has no caller: the function response cache does not vary by role';

/** Owner facts a block's checks need. */
export interface MappingBlockOptions {
  /** Function output: `attributes.rawResponse` (false → `statusCode` / `headers` targets are ignored, a warning). */
  rawResponse?: boolean;
}

/**
 * Static checks Forge can make before publish. The runtime's
 * `MappingBlockValidator` / `DeclarativeMappingPlan` stay the authority: they
 * also compile every expression (types, member names of `data`, conversions).
 * A bare phase (`'input'` / `'output'`) is a task binding's block.
 */
export function validateMappingBlock(
  phaseOrSite: MappingPhase | MappingSiteKind,
  block: MappingBlock | undefined,
  options: MappingBlockOptions = {},
): MappingIssue[] {
  if (!block) return [];
  const site = toSiteKind(phaseOrSite);
  const issues: MappingIssue[] = [];
  const error = (field: string, message: string, part?: MappingIssue['part']) =>
    issues.push({ field, message, severity: 'error', ...(part ? { part } : {}) });
  const warning = (field: string, message: string) =>
    issues.push({ field, message, severity: 'warning' });
  const writeHint = WRITE_HINTS[site];

  const roots = documentRoots(site);
  const checkTarget = (field: string, path: string, part?: MappingIssue['part']) => {
    if (roots && isWritePath(path)) {
      const first = firstPathSegment(path) ?? '';
      if (!roots.includes(first)) {
        error(field, `Must start at a member of ${DOCUMENT_NOUN[site]}: ${roots.map((r) => `$.${r}`).join(', ')}.`, part);
      } else if ((WHOLE_MEMBERS[site] ?? []).includes(first) && !isWholeMember(path)) {
        error(field, `Write $.${first} as a whole.`, part);
      } else if (site === 'functionOutput' && options.rawResponse !== true && (first === 'statusCode' || first === 'headers')) {
        warning(
          field,
          `'rawResponse' is false: the function answers { "<functionKey>": data } and ignores $.${first}. Set 'rawResponse': true to send the status code and headers, or remove the target.`,
        );
      }
      return;
    }
    const ok = site === 'taskInput' ? isInputWritePath(path) : isWritePath(path);
    if (!ok) {
      error(field, `Not a writable target. Use ${writeHint}.`, part);
    }
  };

  if (block.select !== undefined) {
    if (!isReadPath(block.select)) {
      error(
        'select',
        "Not a supported path. Use $, .name, ['name'], [n] or [*] (no filters, no recursive descent).",
      );
    } else if (site === 'taskInput' && block.select === '$') {
      error('select', 'An input select starts with a variable name, for example $.data.customer.');
    } else if (site === 'taskInput' && CONFIG_SELECT.test(block.select)) {
      error('select', 'config is not selectable; read a key with config.get("Key") in a set expression.');
    } else if (site === 'taskInput' && HEADERS_SELECT.test(block.select)) {
      error('select', 'headers is not selectable; read a header with headers["x-channel"] in a set expression.');
    } else if (!isTaskSite(site) && !siteReadsResult(site)) {
      const first = firstPathSegment(block.select) ?? '';
      const selectable = siteVariableNames(site).filter((v) => v !== 'headers');
      if (first === 'headers') {
        error('select', 'headers is not selectable; read a header with headers["x-channel"] in a set expression.');
      } else if (!selectable.includes(first)) {
        error('select', `select starts at a variable: ${selectable.map((v) => `$.${v}`).join(', ')}.`);
      }
    }
  }
  if (block.into !== undefined) checkTarget('into', block.into);
  if (site === 'taskInput') {
    if (block.select !== undefined && block.into === undefined)
      error('into', 'An input select needs an into target.');
    if (block.into !== undefined && block.select === undefined)
      error('select', 'An input into needs a select path.');
  } else if (sitePairsSelectInto(site)) {
    const noun =
      site === 'subFlowInput' ? 'A SubFlow input' : site === 'eventInput' ? 'An event input' : 'An output response';
    if (block.select !== undefined && block.into === undefined)
      error('into', `${noun} select needs an into naming the ${PATH_NOUN[site]} path it copies to.`);
    if (block.into !== undefined && block.select === undefined)
      error('select', `${noun} into needs a select: it has no default source.`);
  } else if (site === 'transitionOutput') {
    if (block.into !== undefined && block.select === undefined)
      error('select', 'A transition output into needs a select: it has no default source.');
  }

  if (block.set !== undefined) {
    const entries = isRecord(block.set) ? Object.entries(block.set) : [];
    if (entries.length === 0) error('set', 'Add at least one entry or remove set.');
    for (const [key, expression] of entries) {
      const field = `set['${key}']`;
      checkTarget(field, key, 'target');
      if (typeof expression !== 'string' || expression.trim() === '') {
        error(field, 'The expression is empty.', 'expression');
        continue;
      }
      if (expression.length > EXPRESSION_MAX_LENGTH) {
        error(
          field,
          `The expression is longer than ${EXPRESSION_MAX_LENGTH} characters.`,
          'expression',
        );
      }
      if (containsAssignment(expression)) {
        error(
          field,
          'Assignment is disabled: an expression produces a value; only into and set keys write.',
          'expression',
        );
      }
      const pascal = PASCAL_INSTANCE_MEMBER.exec(expression) ?? PASCAL_USER_MEMBER.exec(expression);
      if (pascal) {
        const member = pascal[1];
        error(
          field,
          `Members are camelCase: use ${member.charAt(0).toLowerCase()}${member.slice(1)} (only the legacy context keeps PascalCase).`,
          'expression',
        );
      }
      if (site === 'taskInput' && /\bresult\b/.test(expression.replace(/"(?:[^"\\]|\\.)*"/g, '""'))) {
        error(field, 'result is only available in the output block.', 'expression');
      }
      if (!isTaskSite(site)) {
        if (!siteReadsResult(site) && usesRootIdentifier(expression, 'result')) {
          error(
            field,
            site === 'transitionOutput'
              ? 'A transition output has no result; read the request with input.'
              : site === 'eventInput'
                ? 'result does not exist in an event mapping; read the payload with input.'
                : site === 'workflowOutput'
                  ? 'A workflow output has no result; read the instance with data.'
                  : 'result is only available in the SubFlow output block.',
            'expression',
          );
        }
        const taskOnly = ['task', 'config', 'urlEncode'].find((n) => usesRootIdentifier(expression, n));
        if (taskOnly) {
          error(field, `${taskOnly} exists in task mappings only.`, 'expression');
        }
        if (site === 'eventInput') {
          const missing = ['data', 'instance', 'user'].find((n) => usesRootIdentifier(expression, n));
          if (missing) {
            error(
              field,
              `${missing} does not exist in an event mapping: the event has no instance yet. Use input, now, context or headers.`,
              'expression',
            );
          }
        }
        if (site === 'functionOutput' && usesRootIdentifier(expression, 'user')) {
          error(field, `${FUNCTION_OUTPUT_NO_CALLER}.`, 'expression');
        }
      }
    }
  }

  if (block.select === undefined && block.into === undefined && block.set === undefined) {
    warning('', 'The block is empty; it is removed when saved.');
  }
  return issues;
}

/** The transition members this module reads (a transition owns `output` only). */
export interface TransitionBlocksLike extends MappingBindingLike {
  triggerType?: unknown;
}

/**
 * Owner-level checks of a transition's blocks (runtime `MappingBlockValidator.CheckInput`,
 * `WorkflowValidator` automatic / scheduled rules). `mapping` + `output` is the
 * `both` content the mode field shows.
 */
export function transitionBlockIssues(transition: TransitionBlocksLike | null | undefined): MappingIssue[] {
  if (!transition) return [];
  const issues: MappingIssue[] = [];
  if (transition.input !== undefined && transition.input !== null) {
    issues.push({
      field: 'input',
      severity: 'error',
      message: "'input' is not supported on a transition; use 'output'.",
    });
  }
  if (transition.output !== undefined && transition.output !== null) {
    if (transition.triggerType === 1 || transition.triggerType === 2) {
      issues.push({
        field: 'output',
        severity: 'error',
        message: `An ${transition.triggerType === 1 ? 'automatic' : 'scheduled'} transition takes no output block: it has no request to map.`,
      });
    }
  }
  return issues;
}

/** Whether a transition of this trigger type may carry an `output` block (not automatic, not scheduled). */
export function transitionTakesOutput(triggerType: unknown): boolean {
  return triggerType !== 1 && triggerType !== 2;
}

/** Owner-level check of a SubFlow's blocks: they apply to `type: S` only (`MappingBlockValidator.ValidateSubFlowBlocks`). */
export function subFlowBlockIssues(
  subFlow: (MappingBindingLike & { type?: unknown }) | null | undefined,
): MappingIssue[] {
  if (!subFlow || !hasDeclarativeBlocks(subFlow) || subFlow.type === 'S') return [];
  return [
    {
      field: '',
      severity: 'error',
      message:
        "Declarative input / output blocks apply to a SubFlow ('S') only; a SubProcess ('P') is started by its own task.",
    },
  ];
}

/* ────────────── Edits (immer drafts or plain objects) ────────────── */

const MEMBER_ORDER: readonly (keyof MappingBlock)[] = ['select', 'into', 'set'];

/**
 * Updates one member of a block, creating the block when needed and dropping
 * it when it ends up empty. An existing member is changed in place; a new
 * member goes to its contract position (`select`, `into`, `set`) relative to
 * the members already there, which keep their order.
 */
export function setBlockMember<K extends keyof MappingBlock>(
  binding: MappingBindingLike,
  phase: MappingPhase,
  member: K,
  value: MappingBlock[K] | undefined,
): void {
  const current = binding[phase];
  const block: Record<string, unknown> | undefined = isRecord(current) ? current : undefined;
  if (value === undefined) {
    if (!block) return;
    delete block[member];
    if (Object.keys(block).length === 0) delete binding[phase];
    return;
  }
  if (!block) {
    binding[phase] = { [member]: value };
    return;
  }
  if (member in block) {
    block[member] = value;
    return;
  }
  const rank = MEMBER_ORDER.indexOf(member);
  const next: Record<string, unknown> = {};
  let placed = false;
  for (const [key, existing] of Object.entries(block)) {
    const keyRank = MEMBER_ORDER.indexOf(key as keyof MappingBlock);
    if (!placed && keyRank > rank) {
      next[member] = value;
      placed = true;
    }
    next[key] = existing;
  }
  if (!placed) next[member] = value;
  binding[phase] = next;
}

/** Ordered `set` entries. */
export function setEntries(block: MappingBlock | undefined): [string, string][] {
  const set = block?.set;
  return isRecord(set) ? Object.entries(set) : [];
}

function writeSet(
  binding: MappingBindingLike,
  phase: MappingPhase,
  entries: [string, string][],
): void {
  setBlockMember(
    binding,
    phase,
    'set',
    entries.length === 0 ? undefined : Object.fromEntries(entries),
  );
}

/** A `set` key not used yet: `<base>`, `<base>2`, … */
export function uniqueSetKey(block: MappingBlock | undefined, base: string): string {
  const used = new Set(setEntries(block).map(([k]) => k));
  if (!used.has(base)) return base;
  for (let i = 2; ; i += 1) {
    if (!used.has(`${base}${i}`)) return `${base}${i}`;
  }
}

/** Appends an entry (last in declaration order). Returns the key used. */
export function addSetEntry(
  binding: MappingBindingLike,
  phase: MappingPhase,
  key: string,
  expression = '',
): string {
  const block = readMappingBlock(binding, phase);
  const unique = uniqueSetKey(block, key);
  const set = block?.set;
  if (isRecord(set)) {
    set[unique] = expression;
  } else {
    setBlockMember(binding, phase, 'set', { [unique]: expression });
  }
  return unique;
}

/** Changes one entry's expression; the key keeps its position. */
export function setSetExpression(
  binding: MappingBindingLike,
  phase: MappingPhase,
  key: string,
  expression: string,
): void {
  const set = readMappingBlock(binding, phase)?.set;
  if (!isRecord(set) || !(key in set)) return;
  set[key] = expression;
}

export type RenameResult = 'renamed' | 'unchanged' | 'duplicate' | 'missing';

/** Renames an entry at its position. Refuses a key another entry already uses. */
export function renameSetKey(
  binding: MappingBindingLike,
  phase: MappingPhase,
  from: string,
  to: string,
): RenameResult {
  if (from === to) return 'unchanged';
  const entries = setEntries(readMappingBlock(binding, phase));
  const index = entries.findIndex(([k]) => k === from);
  if (index < 0) return 'missing';
  if (entries.some(([k]) => k === to)) return 'duplicate';
  entries[index] = [to, entries[index][1]];
  writeSet(binding, phase, entries);
  return 'renamed';
}

export function removeSetEntry(
  binding: MappingBindingLike,
  phase: MappingPhase,
  key: string,
): void {
  const entries = setEntries(readMappingBlock(binding, phase)).filter(([k]) => k !== key);
  writeSet(binding, phase, entries);
}

/** Moves an entry one step up (`-1`) or down (`+1`) in declaration order. */
export function moveSetEntry(
  binding: MappingBindingLike,
  phase: MappingPhase,
  key: string,
  direction: -1 | 1,
): void {
  const entries = setEntries(readMappingBlock(binding, phase));
  const from = entries.findIndex(([k]) => k === key);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= entries.length) return;
  [entries[from], entries[to]] = [entries[to], entries[from]];
  writeSet(binding, phase, entries);
}

/** Switches the binding to declarative mode: drops the C# mapping. */
export function switchToDeclarative(binding: MappingBindingLike): void {
  delete binding.mapping;
}

/** Switches the binding to script mode: drops both declarative blocks. */
export function switchToScript(binding: MappingBindingLike): void {
  delete binding.input;
  delete binding.output;
}

/* ────────────── Output member: script or block (workflow / function `output`) ────────────── */

/** Members that make an `output` object a script (runtime: `location` or `code`; `encoding` / `scripts` travel with it). */
const SCRIPT_MEMBERS = ['location', 'code', 'encoding', 'scripts'] as const;
const BLOCK_MEMBERS = ['select', 'into', 'set'] as const;

/**
 * What a workflow / function `output` holds: a script (`location` / `code`), a block (`select` / `into` / `set`),
 * both kinds of members (the runtime fails to deserialize it: publish 400 naming `output`), or nothing.
 */
export function outputMappingContent(value: unknown): BindingMappingContent {
  if (!isRecord(value)) return 'empty';
  const script = value.location !== undefined || value.code !== undefined;
  const block = BLOCK_MEMBERS.some((m) => value[m] !== undefined);
  if (script && block) return 'both';
  if (script) return 'script';
  if (block) return 'declarative';
  return 'empty';
}

/** {@link bindingMappingContent} by owner: an output-member owner reads its `output` object's shape. */
export function ownerMappingContent(
  owner: MappingOwnerKind,
  binding: MappingBindingLike | null | undefined,
): BindingMappingContent {
  return isOutputMemberOwner(owner) ? outputMappingContent(binding?.output) : bindingMappingContent(binding);
}

type OwnerUpdater = (binding: MappingBindingLike) => void;

/** Switches to declarative: drops the script. On an output-member owner that replaces the whole `output` object. */
export function ownerSwitchToDeclarative(owner: MappingOwnerKind): OwnerUpdater {
  return isOutputMemberOwner(owner) ? (b) => void delete b.output : switchToDeclarative;
}

/** Switches to script: drops the blocks. On an output-member owner that replaces the whole `output` object. */
export function ownerSwitchToScript(owner: MappingOwnerKind): OwnerUpdater {
  return isOutputMemberOwner(owner) ? (b) => void delete b.output : switchToScript;
}

/** Resolves a `both` owner by keeping the script. */
export function ownerKeepScript(owner: MappingOwnerKind): OwnerUpdater {
  if (!isOutputMemberOwner(owner)) return switchToScript;
  return (b) => {
    if (!isRecord(b.output)) return;
    for (const m of BLOCK_MEMBERS) delete b.output[m];
  };
}

/** Resolves a `both` owner by keeping the blocks. */
export function ownerKeepBlocks(owner: MappingOwnerKind): OwnerUpdater {
  if (!isOutputMemberOwner(owner)) return switchToDeclarative;
  return (b) => {
    if (!isRecord(b.output)) return;
    for (const m of SCRIPT_MEMBERS) delete b.output[m];
  };
}

/* ────────────── Event owner ────────────── */

/**
 * Applies `updater` to `owner.event` (workflow attributes or a transition), creating the event when
 * needed and dropping it when it ends up empty (an event with neither `mapping` nor `input` is the
 * runtime's `EventDefinitionMissing`).
 */
export function updateEventOwner(
  owner: Record<string, unknown>,
  updater: (event: MappingBindingLike) => void,
): void {
  if (!isRecord(owner.event)) owner.event = {};
  const event = owner.event as MappingBindingLike;
  updater(event);
  if (Object.keys(event).length === 0) Reflect.deleteProperty(owner, 'event');
}
