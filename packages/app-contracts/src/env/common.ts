import { z } from 'zod'

/**
 * Cross-shell building blocks for env-driven configuration.
 *
 * Per audit item R-b7, every shell (`apps/server`, `apps/web`,
 * `apps/extension`) reads its own env via its own config module — but the
 * primitives those modules use must come from a single, shell-neutral home
 * so semantics never drift. Examples:
 *
 *  - `LogLevelSchema` — Pino-compatible log levels accepted by every shell.
 *  - `csvList()`        — comma-separated env → trimmed, non-empty `string[]`.
 *  - `coercedBool()`    — accept `true | "true" | false | "false"` from env.
 *  - `isLoopbackHost()` — single source of truth for "are we local-trust?".
 *
 * This module deliberately depends on **only** Zod. It does NOT read
 * `process.env` itself. Shells own that boundary so this package stays a
 * pure types/utilities layer (no Node-only side effects).
 */

/**
 * Pino-compatible log levels. Mirrored verbatim by `apps/server`'s logger
 * config and any future shell that wants symmetric levels.
 */
export const LogLevelSchema = z.enum([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
])
export type LogLevel = z.infer<typeof LogLevelSchema>

/**
 * Standard Node lifecycle markers, surfaced in log records and used for
 * dev-vs-prod conditionals.
 */
export const NodeEnvSchema = z.enum(['development', 'production', 'test'])
export type NodeEnv = z.infer<typeof NodeEnvSchema>

/**
 * Comma-separated string env (or already-parsed `string[]`) into a clean
 * `string[]`. Empty entries are dropped so `FOO=` parses to `[]` rather
 * than `['']`. Returns `undefined` if the input is itself undefined so the
 * caller's `.default([])` (or similar) wins.
 */
export const csvList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean)
    if (typeof value === 'string')
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    return undefined
  })

/**
 * Coerce env-shaped booleans. Accepts a real boolean (already parsed by
 * the host, e.g. VS Code `getConfiguration().get<boolean>(...)`) or the
 * strings `"true"`/`"false"` (case-insensitive) coming from process env.
 * Anything else falls through to the schema's own `.default(...)`.
 */
export const coercedBool = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'string' ? value.trim().toLowerCase() === 'true' : value,
  )

/**
 * `true` when the configured bind address is a loopback interface. The
 * single source of truth for "are we in single-developer / local trust
 * mode?". Used by server bootstrap warnings and by per-method capability
 * gating in `services-core`.
 *
 * Note: `0.0.0.0` is intentionally NOT treated as loopback — binding to
 * all interfaces is exactly the deployment shape that needs gating.
 */
export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase()
  return (
    normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost'
  )
}
