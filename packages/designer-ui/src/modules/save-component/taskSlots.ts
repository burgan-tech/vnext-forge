/**
 * Response slots of task entries (`onEntries` / `onExits` / `onExecutionTasks`).
 *
 * Each entry files its output under a slot in `ScriptContext.TaskResponse`:
 * `variableKey` verbatim when set (runtime 0.0.99 / vnext-schema 0.0.55),
 * else the runtime's `ToVariableName(task.key)`. The runtime rejects at
 * publish:
 *  - workflows (`WorkflowValidator`): two entries of one collection at the
 *    same `order` sharing a slot — they run in parallel. A later order may
 *    reuse a slot and overwrites it.
 *  - functions (`FunctionComponentValidator`): two entries sharing a slot,
 *    whatever their order.
 *  - a `variableKey` that is not `^[A-Za-z_][A-Za-z0-9_]*$` or exceeds 100 chars.
 */

/** Mirror of the runtime's `StringExtensions.ToVariableName`. */
export function toVariableName(key: string): string {
  if (key.trim() === '') return key;
  const words = key.split(/[-_\s]+/).filter((word) => word.trim() !== '');
  if (words.length === 0) return key;
  let result = words[0].toLowerCase();
  for (const word of words.slice(1)) {
    result += word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  if (!/^[\p{L}_]/u.test(result)) result = `_${result}`;
  return result;
}

export const VARIABLE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const VARIABLE_KEY_MAX_LENGTH = 100;

/** Null when valid, otherwise a user-facing reason. */
export function variableKeyError(value: string): string | null {
  if (value.length > VARIABLE_KEY_MAX_LENGTH) return `At most ${VARIABLE_KEY_MAX_LENGTH} characters`;
  if (!VARIABLE_KEY_PATTERN.test(value)) return 'Letters, digits and underscores only; must not start with a digit';
  return null;
}

interface TaskEntryLike {
  order?: unknown;
  variableKey?: unknown;
  task?: { key?: unknown } | null;
}

function entryKey(entry: unknown): string | null {
  const key = (entry as TaskEntryLike | null)?.task?.key;
  return typeof key === 'string' && key.trim() !== '' ? key : null;
}

function entryVariableKey(entry: unknown): string | null {
  const v = (entry as TaskEntryLike | null)?.variableKey;
  return typeof v === 'string' && v !== '' ? v : null;
}

/** The slot an entry writes to, or null when it has no task key yet. */
export function effectiveTaskSlot(entry: unknown): string | null {
  const variableKey = entryVariableKey(entry);
  if (variableKey) return variableKey;
  const key = entryKey(entry);
  return key ? toVariableName(key) : null;
}

export interface TaskKeyCollision {
  index: number;
  key: string;
  collidesWith: string;
  variableName: string;
  /** Workflow mode only: the shared `order`. */
  order?: number;
}

/**
 * `function` (default): slots must be distinct across all entries.
 * `workflow`: slots must be distinct among entries with the same `order`.
 */
export function findTaskKeyCollisions(tasks: unknown[], mode: 'function' | 'workflow' = 'function'): TaskKeyCollision[] {
  const claimed = new Map<string, string>();
  const collisions: TaskKeyCollision[] = [];
  tasks.forEach((entry, index) => {
    const key = entryKey(entry);
    const slot = effectiveTaskSlot(entry);
    if (!key || !slot) return;
    const rawOrder = (entry as TaskEntryLike).order;
    const order = typeof rawOrder === 'number' ? rawOrder : undefined;
    const bucket = mode === 'workflow' ? `${order ?? ''}\u0000${slot}` : slot;
    const first = claimed.get(bucket);
    if (first !== undefined) {
      collisions.push({ index, key, collidesWith: first, variableName: slot, ...(mode === 'workflow' && order !== undefined ? { order } : {}) });
      return;
    }
    claimed.set(bucket, key);
  });
  return collisions;
}

export interface InvalidVariableKey {
  index: number;
  variableKey: string;
  reason: string;
}

export function findInvalidVariableKeys(tasks: unknown[]): InvalidVariableKey[] {
  const out: InvalidVariableKey[] = [];
  tasks.forEach((entry, index) => {
    const variableKey = entryVariableKey(entry);
    if (variableKey === null) return;
    const reason = variableKeyError(variableKey);
    if (reason) out.push({ index, variableKey, reason });
  });
  return out;
}
