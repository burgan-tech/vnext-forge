/**
 * Built-in (system) function keys of the vNext runtime. A custom function
 * with one of these keys is shadowed on that route: the runtime answers with
 * the built-in. `file` joined the list in runtime 0.0.100.
 */
const INSTANCE_SYSTEM_FUNCTIONS = [
  'state',
  'data',
  'view',
  'schema',
  'master',
  'catalog',
  'tasks',
  'actions',
  'instance-correlation',
  'file',
] as const;

const DOMAIN_SYSTEM_FUNCTIONS = ['human-task'] as const;

/** Why `key` cannot be called as a custom function, or `null` when it can. */
export function reservedFunctionKeyWarning(key: string): string | null {
  const k = key.trim().toLowerCase();
  if ((INSTANCE_SYSTEM_FUNCTIONS as readonly string[]).includes(k)) {
    return `"${k}" is a built-in system function: the instance route …/functions/${k} always runs the built-in, so this function cannot be called there. Pick another key.`;
  }
  if ((DOMAIN_SYSTEM_FUNCTIONS as readonly string[]).includes(k)) {
    return `"${k}" is a built-in system function on the domain route; this function cannot be called there. Pick another key.`;
  }
  return null;
}
