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
const INPUT_WRITE_PATH = new RegExp(
  `^\\$(?:\\.(?:body|headers|query)|\\['(?:body|headers|query)'\\])(?:${DOT_SEGMENT}|${QUOTED_SEGMENT})*$`,
);
const ROUTE_PATH = /^\$(?:\.route|\['route'\])(?:[.[]|$)/;

export const PATH_MAX_LENGTH = 1000;
export const EXPRESSION_MAX_LENGTH = 8000;

export function isReadPath(path: string): boolean {
  return path.length <= PATH_MAX_LENGTH && READ_PATH.test(path);
}

/** Instance-data write target (output `into` / `set` key): no index, no wildcard, not the root. */
export function isWritePath(path: string): boolean {
  return path.length <= PATH_MAX_LENGTH && WRITE_PATH.test(path);
}

/** Request-surface write target (input `into` / `set` key): `$.body`, `$.headers`, `$.query`. */
export function isInputWritePath(path: string): boolean {
  return path.length <= PATH_MAX_LENGTH && INPUT_WRITE_PATH.test(path);
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

/**
 * Static checks Forge can make before publish. The runtime's
 * `MappingBlockValidator` stays the authority: it also compiles every
 * expression (types, member names of `data`, conversions).
 */
export function validateMappingBlock(
  phase: MappingPhase,
  block: MappingBlock | undefined,
): MappingIssue[] {
  if (!block) return [];
  const issues: MappingIssue[] = [];
  const error = (field: string, message: string, part?: MappingIssue['part']) =>
    issues.push({ field, message, severity: 'error', ...(part ? { part } : {}) });
  const warning = (field: string, message: string) =>
    issues.push({ field, message, severity: 'warning' });
  const writeOk = phase === 'input' ? isInputWritePath : isWritePath;
  const writeHint =
    phase === 'input'
      ? "a request surface: $.body, $.headers or $.query, then .name / ['name'] segments"
      : "an instance-data path: $ then .name / ['name'] segments (no index, no wildcard, not the root)";

  const checkTarget = (field: string, path: string, part?: MappingIssue['part']) => {
    if (phase === 'input' && ROUTE_PATH.test(path)) {
      error(field, '$.route is not supported: no task type has a route surface yet.', part);
    } else if (!writeOk(path)) {
      error(field, `Not a writable target. Use ${writeHint}.`, part);
    }
  };

  if (block.select !== undefined) {
    if (!isReadPath(block.select)) {
      error(
        'select',
        "Not a supported path. Use $, .name, ['name'], [n] or [*] (no filters, no recursive descent).",
      );
    } else if (phase === 'input' && block.select === '$') {
      error('select', 'An input select starts with a variable name, for example $.data.customer.');
    }
  }
  if (block.into !== undefined) checkTarget('into', block.into);
  if (phase === 'input') {
    if (block.select !== undefined && block.into === undefined)
      error('into', 'An input select needs an into target.');
    if (block.into !== undefined && block.select === undefined)
      error('select', 'An input into needs a select path.');
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
      if (phase === 'input' && /\bresult\b/.test(expression.replace(/"(?:[^"\\]|\\.)*"/g, '""'))) {
        error(field, 'result is only available in the output block.', 'expression');
      }
    }
  }

  if (block.select === undefined && block.into === undefined && block.set === undefined) {
    warning('', 'The block is empty; it is removed when saved.');
  }
  return issues;
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
