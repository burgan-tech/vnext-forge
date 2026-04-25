/**
 * Minimal process environment for child processes (R-b17).
 * Filters the current `process.env` through an allowlist, then merges `extras`.
 */
export const DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'TEMP',
  'TMP',
  'SYSTEMROOT',
  'COMSPEC',
  'NODE_ENV',
  'LANG',
  'LC_ALL',
  'TZ',
] as const

export function buildChildEnv(
  allowlist: readonly string[],
  extras?: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {}
  for (const key of allowlist) {
    const value = process.env[key]
    if (value !== undefined) {
      out[key] = value
    }
  }
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value !== undefined) {
        out[key] = value
      }
    }
  }
  return out
}
