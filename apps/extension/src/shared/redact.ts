/**
 * Hide credentials passed as CLI flags before anything reaches a VS Code
 * surface (Output channel, warning toast, etc). `postgres/postgres` is the
 * runtime repo's public local-dev credential, but a log or toast is still the
 * wrong place for it.
 *
 * Handles the unquoted, `=`-joined, and single/double-quoted forms so a
 * quoted multi-word value (`--DB_PASSWORD "my secret"`) is redacted as one
 * unit instead of leaking its second word.
 */
const DB_PASSWORD_PATTERN = /(--DB_PASSWORD)(\s+|=)("[^"]*"|'[^']*'|\S+)/g;

export function redactSecrets(text: string): string {
  return text.replace(DB_PASSWORD_PATTERN, '$1$2***');
}
