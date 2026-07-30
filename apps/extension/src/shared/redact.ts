import { stripAnsi } from '@vnext-forge-studio/services-core';

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

/**
 * The single sanitiser for any text about to be shown to a human — Output
 * channel line, notification, error message.
 *
 * Two problems, one function, because composing them per call site is how the
 * order ends up wrong somewhere:
 *
 * 1. The runtime Makefile and the `wf` CLI (chalk) colour their output, and a
 *    VS Code OutputChannel prints ANSI escape sequences literally instead of
 *    interpreting them — the user sees `ESC[33mStarting…ESC[0m`.
 * 2. Credentials passed as CLI flags must never reach a log or a toast.
 *
 * **The order is load-bearing: ANSI first, then redaction.** `redactSecrets`
 * matches `--DB_PASSWORD` followed by its value, and in coloured output an
 * escape sequence can sit between the flag and the value or wrap either of
 * them — which stops the pattern matching and leaks the password into text
 * that looks sanitised. Stripping first guarantees the redaction sees a clean
 * string. Do not "simplify" this into the other order.
 *
 * Escape sequences only: `✗`, `…`, box-drawing characters and emoji all
 * survive, since the goal is readable output rather than ASCII-only output.
 *
 * Display paths should call this rather than `redactSecrets`, which stays
 * exported as the unit-tested primitive this composes.
 */
export function sanitizeForDisplay(text: string): string {
  return redactSecrets(stripAnsi(text));
}
