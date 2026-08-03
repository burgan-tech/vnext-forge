/**
 * Shape guards for read-only component detail views.
 *
 * Component documents arrive from the monitor API, so every `attributes.*`
 * sub-object is untrusted: a field the designer writes as an object can show
 * up as a string, an array, or be missing entirely. Narrow with these guards
 * instead of asserting straight from `unknown` — an unchecked cast lets a
 * scalar reach code that iterates or property-accesses it (e.g.
 * `Object.entries(cache)` walking the characters of a string).
 */

/**
 * Narrows to a plain object. Arrays and scalars are rejected, so the result is
 * safe to enumerate or read properties from. Returns `null` when the value is
 * not a plain object, which composes with `{value && …}` render gates.
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A task reference as it appears inside function/extension documents. */
export interface TaskRefLike {
  key?: string;
  domain?: string;
  version?: string;
  flow?: string;
}

/** Loose helper-reference shape: `sys-mappings` refs as they arrive on the wire. */
export interface HelperRefLike {
  key?: unknown;
  version?: unknown;
  domain?: unknown;
  flow?: unknown;
}

/** A C# script attachment (mapping/output/body) as consumed by ReadOnlyScriptSection. */
export interface ScriptLike {
  location?: string;
  code?: unknown;
  encoding?: string;
  scripts?: { helpers?: HelperRefLike[]; allowedAssemblies?: string[] };
}

/** Narrows an untrusted wire value to `ScriptLike` (field-by-field typeof checks). */
export function asScriptLike(value: unknown): ScriptLike | null {
  const record = asRecord(value);
  if (!record) return null;
  const scripts = asRecord(record.scripts);
  return {
    location: typeof record.location === 'string' ? record.location : undefined,
    code: record.code,
    encoding: typeof record.encoding === 'string' ? record.encoding : undefined,
    scripts: scripts
      ? {
          helpers: Array.isArray(scripts.helpers)
            ? scripts.helpers.map((helper) => asRecord(helper) ?? {})
            : undefined,
          allowedAssemblies: Array.isArray(scripts.allowedAssemblies)
            ? scripts.allowedAssemblies.filter((entry): entry is string => typeof entry === 'string')
            : undefined,
        }
      : undefined,
  };
}

/** Normalized task execution entry shared by function and extension cores. */
export interface TaskExecutionLike {
  order?: number;
  task?: TaskRefLike;
  mapping?: ScriptLike | null;
}

/**
 * Task attachments come in TWO wire shapes:
 *   1. editor-authored: `{ order, task: {key, domain, version, flow}, mapping }`
 *      (written by FunctionSingleTaskSection / ExtensionTaskSection)
 *   2. canonical template / real-world: the reference DIRECTLY, i.e.
 *      `{ key, domain, version, flow }` with no nesting
 *      (see vnext-defaults/templates/example-function.json).
 * Accept both; return the editor-authored shape or null.
 */
export function asTaskExecution(value: unknown): TaskExecutionLike | null {
  const record = asRecord(value);
  if (!record) return null;

  const nested = asRecord(record.task);
  if (nested) {
    return {
      order: typeof record.order === 'number' ? record.order : undefined,
      task: nested as TaskRefLike,
      mapping: asScriptLike(record.mapping),
    };
  }

  if (typeof record.key === 'string' && record.key) {
    return {
      order: typeof record.order === 'number' ? record.order : undefined,
      task: record as TaskRefLike,
      mapping: asRecord(record.mapping),
    };
  }

  return null;
}
