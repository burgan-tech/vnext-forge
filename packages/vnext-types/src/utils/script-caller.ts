/**
 * `ScriptContext.Caller` (runtime 0.0.105, `ICallerAccessor`): the caller's
 * role set as the runtime resolved it, readable only on some script surfaces.
 * Mirrors the availability table of the runtime doc
 * `docs/runtime/script-caller-roles.md` (councils
 * `2026-11-12-script-caller-roles` and `…-background`).
 *
 * Every script sees `context.Caller`; on a surface with no caller
 * `IsAvailable` is false and `HasRoleAsync` / `RolesAsync` throw
 * `CallerRolesUnavailableException` — never an empty set.
 */

/** Where a script runs, as far as caller roles are concerned. */
export type ScriptCallerSurface =
  | 'transitionSchemaRule'
  | 'functionContractRule'
  | 'viewRule'
  | 'automaticRule'
  | 'timer'
  | 'subFlowMapping'
  | 'taskMapping'
  | 'transitionMapping'
  | 'extension'
  | 'resourceLock'
  | 'eventMapping';

/**
 * - `request`: always a caller (the request that asked for the selection).
 * - `callerDriven`: a caller only when one drove the hop; System hops (a fired
 *   timer, a SubFlow resume, a continuation) have none — guard `IsAvailable`.
 * - `unavailable`: never a caller; a read throws.
 */
export type ScriptCallerAvailability = 'request' | 'callerDriven' | 'unavailable';

export interface ScriptCallerSurfaceInfo {
  availability: ScriptCallerAvailability;
  /** Lower-case noun phrase for messages, e.g. "a task mapping". */
  label: string;
  /** Whose roles the accessor answers with; absent where unavailable. */
  whose?: string;
}

export const SCRIPT_CALLER_SURFACES: Record<ScriptCallerSurface, ScriptCallerSurfaceInfo> = {
  transitionSchemaRule: { availability: 'request', label: 'a transition schemas rule', whose: "the request's caller" },
  functionContractRule: { availability: 'request', label: 'a function contract rule', whose: "the request's caller" },
  viewRule: { availability: 'request', label: 'a view rule', whose: "the request's caller" },
  automaticRule: {
    availability: 'callerDriven',
    label: 'an automatic-transition rule',
    whose: 'the caller who drove the hop (none on System hops such as a fired timer)',
  },
  timer: {
    availability: 'callerDriven',
    label: 'a timer script',
    whose: 'the caller who entered the state (none when a fired timer re-arms)',
  },
  subFlowMapping: {
    availability: 'callerDriven',
    label: 'a SubFlow output mapping',
    whose: "the child settler, not the parent's starter (none when a timer settled the child)",
  },
  taskMapping: { availability: 'unavailable', label: 'a task mapping' },
  transitionMapping: { availability: 'unavailable', label: 'a transition mapping' },
  extension: { availability: 'unavailable', label: 'an extension' },
  resourceLock: { availability: 'unavailable', label: 'a resource-lock key script' },
  eventMapping: { availability: 'unavailable', label: 'an event mapping' },
};

/** True when `context.Caller` can answer with roles on this surface (possibly guarded). */
export function scriptCallerAvailable(surface: ScriptCallerSurface | undefined): boolean {
  return surface === undefined || SCRIPT_CALLER_SURFACES[surface].availability !== 'unavailable';
}

export type ScriptCallerIssueCode = 'caller.unavailable' | 'caller.unguarded' | 'caller.roleHeader';

export interface ScriptCallerIssue {
  code: ScriptCallerIssueCode;
  severity: 'warning';
  message: string;
  /** 1-based, like Monaco markers. */
  line: number;
  column: number;
  endColumn: number;
}

/**
 * Blanks out comments and the contents of string/char literals (quote
 * delimiters stay) with spaces, keeping newlines, so offsets still map to the
 * original text. Handles `//`, block comments, regular, verbatim (`@"`, `""`
 * escape) and interpolated strings; interpolation holes are blanked too.
 */
export function maskCsxNonCode(code: string): string {
  const out = code.split('');
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i);
      const stop = end < 0 ? code.length : end;
      blank(i, stop);
      i = stop;
    } else if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? code.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'") {
      const verbatim = c === '"' && /@\$?$|\$@$/.test(code.slice(Math.max(0, i - 2), i));
      let j = i + 1;
      while (j < code.length) {
        if (verbatim && code[j] === '"' && code[j + 1] === '"') j += 2;
        else if (!verbatim && code[j] === '\\') j += 2;
        else if (code[j] === c || (!verbatim && code[j] === '\n')) break;
        else j++;
      }
      blank(i + 1, Math.min(j, code.length));
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

/** `.Caller` member access (`context.Caller`, `ctx.Caller`). */
const CALLER_USE = /\.\s*Caller\b/g;
/** A role read: the two members that resolve (and may throw). */
const ROLE_READ = /\b(HasRoleAsync|RolesAsync)\s*\(/g;
const AVAILABILITY_GUARD = /\bIsAvailable\b/;
/** `Headers["role"]`, `Headers?["role"]`, `Headers.role`, `Headers?.role` (any case). */
const ROLE_HEADER_INDEXER = /\bHeaders\s*\??\s*\[\s*@?"/g;
const ROLE_HEADER_MEMBER = /\bHeaders\s*\??\.\s*role\b/gi;
const HANDLER_DECL = /\b(InputHandler|OutputHandler)\s*\(/g;

function position(code: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let k = 0; k < offset; k++) {
    if (code[k] === '\n') {
      line++;
      lineStart = k + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

function issueAt(code: string, offset: number, length: number, rest: Omit<ScriptCallerIssue, 'line' | 'column' | 'endColumn'>): ScriptCallerIssue {
  const { line, column } = position(code, offset);
  return { ...rest, line, column, endColumn: column + length };
}

/**
 * Which handler of an `IMapping` encloses `offset`: the nearest preceding
 * `InputHandler(` / `OutputHandler(` declaration, or undefined before both.
 */
function enclosingHandler(masked: string, offset: number): 'InputHandler' | 'OutputHandler' | undefined {
  let found: 'InputHandler' | 'OutputHandler' | undefined;
  HANDLER_DECL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HANDLER_DECL.exec(masked)) !== null && m.index < offset) found = m[1] as 'InputHandler' | 'OutputHandler';
  return found;
}

/**
 * Editor lint for caller roles (warnings only; the runtime does not reject
 * these scripts at publish):
 *
 * - `caller.unavailable` — `context.Caller` on a surface that never has a
 *   caller (task / transition / event mappings, extensions, resource lock, a
 *   SubFlow mapping's InputHandler): reads throw at runtime.
 * - `caller.unguarded` — an automatic rule, timer script or SubFlow output
 *   mapping reads roles without checking `IsAvailable` (System hops have no
 *   caller, so the read throws and the step fails).
 * - `caller.roleHeader` — the script parses the `role` request header; under
 *   `morph-idm` that header is not the caller's role set. Prefer `context.Caller`.
 *
 * `surface` undefined (a standalone .csx file, an unmapped slot) runs only
 * the surface-independent role-header check. Comments and string contents are
 * ignored.
 */
export function scriptCallerIssues(code: string, surface: ScriptCallerSurface | undefined): ScriptCallerIssue[] {
  if (!code) return [];
  const masked = maskCsxNonCode(code);
  const issues: ScriptCallerIssue[] = [];
  const info = surface ? SCRIPT_CALLER_SURFACES[surface] : undefined;

  if (info) {
    // A SubFlow mapping's InputHandler starts the child: no caller there.
    const unavailableAt = (offset: number): string | undefined => {
      if (info.availability === 'unavailable') return info.label;
      if (surface === 'subFlowMapping' && enclosingHandler(masked, offset) === 'InputHandler') return 'a SubFlow input mapping';
      return undefined;
    };

    CALLER_USE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CALLER_USE.exec(masked)) !== null) {
      const where = unavailableAt(m.index);
      if (!where) continue;
      const start = m.index + m[0].indexOf('Caller');
      issues.push(
        issueAt(code, start, 'Caller'.length, {
          code: 'caller.unavailable',
          severity: 'warning',
          message: `context.Caller is not available in ${where}: IsAvailable is false and reading roles throws CallerRolesUnavailableException. Caller roles reach selection rules (schemas, views, function contracts), automatic-transition rules, timer scripts and SubFlow output mappings only.`,
        }),
      );
    }

    if (info.availability === 'callerDriven' && !AVAILABILITY_GUARD.test(masked)) {
      ROLE_READ.lastIndex = 0;
      while ((m = ROLE_READ.exec(masked)) !== null) {
        if (unavailableAt(m.index)) continue;
        issues.push(
          issueAt(code, m.index, m[1].length, {
            code: 'caller.unguarded',
            severity: 'warning',
            message: `${m[1]} without an IsAvailable guard in ${info.label}: there is no caller on System hops (a fired timer, a SubFlow resume, a continuation), so the read throws and the step fails. Check context.Caller.IsAvailable first and pick a default.`,
          }),
        );
        break;
      }
    }
  }

  const roleHeader = (offset: number, length: number) =>
    issues.push(
      issueAt(code, offset, length, {
        code: 'caller.roleHeader',
        severity: 'warning',
        message:
          'Parsing the "role" header is not the caller\'s role set (under the morph-idm provider the gateway header replaces or bypasses it). Use context.Caller.HasRoleAsync / RolesAsync instead.',
      }),
    );
  ROLE_HEADER_INDEXER.lastIndex = 0;
  let h: RegExpExecArray | null;
  while ((h = ROLE_HEADER_INDEXER.exec(masked)) !== null) {
    const open = h.index + h[0].length; // first char of the literal's content
    const close = code.indexOf('"', open);
    if (close < 0) continue;
    if (code.slice(open, close).trim().toLowerCase() === 'role') roleHeader(h.index, close + 1 - h.index);
  }
  ROLE_HEADER_MEMBER.lastIndex = 0;
  while ((h = ROLE_HEADER_MEMBER.exec(masked)) !== null) roleHeader(h.index, h[0].length);

  return issues.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * Script-panel address → caller surface. `listField` / `scriptField` follow
 * the panel's `ActiveScript` addressing (see designer-ui
 * `ScriptWorkflowSync`). Unknown addresses (notification and long-poll rules,
 * workflow output, cache keys, helper classes) return undefined: no
 * surface-specific lint, and completions stay on.
 */
export function scriptCallerSurfaceOf(address: { listField: string; scriptField: string }): ScriptCallerSurface | undefined {
  const { listField, scriptField } = address;
  if (/(^|\.)schemas\[\d+\]\.rule$/.test(scriptField)) return 'transitionSchemaRule';
  if (/(^|\.)views\[\d+\]\.rule$/.test(scriptField)) return 'viewRule';
  if (/^function(Input|Output)(Schema|View)$/.test(listField) && scriptField === 'rule') return 'functionContractRule';
  if (scriptField === 'resourceLock.keyExpression') return 'resourceLock';
  if (scriptField === 'event.mapping' || (listField === 'event' && scriptField === 'mapping')) return 'eventMapping';
  if (listField === 'subFlow' && scriptField === 'mapping') return 'subFlowMapping';
  if (listField === 'transitions') {
    if (scriptField === 'rule' || scriptField === 'condition') return 'automaticRule';
    if (scriptField === 'timer') return 'timer';
    if (scriptField === 'mapping') return 'transitionMapping';
    if (/^onExecutionTasks\.\d+\.mapping$/.test(scriptField)) return 'taskMapping';
  }
  if (listField === 'timeout' && scriptField === 'mapping') return 'transitionMapping';
  if ((listField === 'onEntries' || listField === 'onExits' || listField === 'onExecutionTasks') && scriptField === 'mapping') return 'taskMapping';
  if (listField === 'functionOutputMapping' && scriptField === 'mapping') return 'taskMapping';
  // Function single task and extension task share this address; both are task mappings.
  if (scriptField === 'task.mapping') return 'taskMapping';
  return undefined;
}
