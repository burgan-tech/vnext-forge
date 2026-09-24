/**
 * Mirror of the runtime's `StringExtensions.ToVariableName` — each
 * `onExecutionTasks` entry files its response under this name in
 * `ScriptContext.TaskResponse` / `OutputResponse`, and the runtime
 * (`FunctionComponentValidator.ValidateTaskKeysDistinct`) rejects two entries
 * that resolve to the same name at publish.
 */
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

export interface TaskKeyCollision {
  index: number;
  key: string;
  collidesWith: string;
  variableName: string;
}

export function findTaskKeyCollisions(tasks: unknown[]): TaskKeyCollision[] {
  const claimed = new Map<string, string>();
  const collisions: TaskKeyCollision[] = [];
  tasks.forEach((entry, index) => {
    const key = (entry as { task?: { key?: unknown } } | null)?.task?.key;
    if (typeof key !== 'string' || key.trim() === '') return;
    const variableName = toVariableName(key);
    const first = claimed.get(variableName);
    if (first !== undefined) {
      collisions.push({ index, key, collidesWith: first, variableName });
      return;
    }
    claimed.set(variableName, key);
  });
  return collisions;
}
