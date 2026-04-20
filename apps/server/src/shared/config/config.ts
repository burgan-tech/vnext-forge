import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

/**
 * Centralized, validated runtime configuration for `@vnext-forge/server`.
 *
 * Single source of truth for every env-driven setting:
 *  - Defaults are baked into the Zod schema, so the server boots even when no
 *    `.env` file is present.
 *  - When a `.env` file exists at the workspace root, Node's `--env-file-if-exists`
 *    loader (see `package.json` -> `dev`) populates `process.env` BEFORE this
 *    module is imported, and those overrides win over the defaults.
 *  - Validation happens once, at startup. Any typed access goes through the
 *    exported `config` singleton.
 *  - The resolved object is also attached to `globalThis.__vnextConfig` so it
 *    can be inspected in dev tools / REPLs without an extra import.
 *
 * This module MUST NOT import the application logger — the logger itself reads
 * its level from `config`, so a circular dependency would be created. The few
 * bootstrap-time messages emitted here use `console.warn` directly (allowed via
 * the workspace ESLint `loggerConsoleFiles` exception).
 */

const ConfigSchema = z.object({
  /** HTTP port the Hono server binds to. */
  port: z.coerce.number().int().positive().default(3001),
  /**
   * Default vNext runtime base URL used by the runtime-proxy service. Each
   * project may still override this per-instance via its own configuration.
   */
  vnextRuntimeUrl: z.string().url().default('http://localhost:4201'),
  /** Pino log level. */
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /**
   * When `true`, the pretty transport prints the full structured payload
   * instead of the compact `time | level | message` line.
   */
  verbose: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : v)),
  /** Standard Node environment marker, surfaced in log records. */
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Resolve the path to the workspace `.env` file. The server's source lives in
 * `apps/server/src/`, the compiled output in `apps/server/dist/`; both are one
 * directory below the workspace root.
 */
function resolveEnvPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..', '.env');
}

function loadConfig(): AppConfig {
  const envPath = resolveEnvPath();
  const envExists = existsSync(envPath);

  const parsed = ConfigSchema.safeParse({
    port: process.env.PORT,
    vnextRuntimeUrl: process.env.VNEXT_RUNTIME_URL,
    logLevel: process.env.LOG_LEVEL,
    verbose: process.env.VERBOSE,
    nodeEnv: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server configuration:\n${formatted}`);
  }

  if (!envExists) {
    console.warn(
      `[vnext-forge/server] No .env file found at ${envPath}. ` +
        'Using built-in defaults: ' +
        `port=${parsed.data.port}, vnextRuntimeUrl=${parsed.data.vnextRuntimeUrl}, ` +
        `logLevel=${parsed.data.logLevel}, nodeEnv=${parsed.data.nodeEnv}. ` +
        'Create apps/server/.env to override.',
    );
  }

  return parsed.data;
}

/**
 * Validated application configuration. Import this object anywhere in the
 * server instead of reading `process.env` directly.
 */
export const config: AppConfig = loadConfig();

// Expose a read-only reference on globalThis for dev-tools / REPL inspection.
// Not intended to be read by application code — always import `config`.
declare global {
  var __vnextConfig: AppConfig | undefined;
}
globalThis.__vnextConfig = config;
