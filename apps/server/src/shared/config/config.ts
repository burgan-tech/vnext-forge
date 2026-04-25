import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LogLevelSchema,
  NodeEnvSchema,
  coercedBool,
  csvList,
  isLoopbackHost as isLoopbackHostShared,
} from '@vnext-forge/app-contracts';
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
  /** Network interface the server binds to. Default `127.0.0.1` (loopback). */
  host: z.string().min(1).default('127.0.0.1'),
  /** HTTP port the Hono server binds to. */
  port: z.coerce.number().int().positive().default(3001),
  /**
   * Default vNext runtime base URL used by the runtime-proxy service. Each
   * project may still override this per-instance via its own configuration.
   */
  vnextRuntimeUrl: z.string().url().default('http://localhost:4201'),
  /**
   * Allowed runtime base URLs that the proxy may target. The default
   * `vnextRuntimeUrl` is implicitly always allowed; this list extends it.
   * Provided as a comma-separated env var.
   */
  runtimeAllowedBaseUrls: csvList.pipe(z.array(z.string().url()).default([])),
  /**
   * When `true`, callers may override the proxy target via the
   * `runtimeUrl` parameter on `runtime.proxy`. This is OFF by default
   * because it is a SSRF foot-gun — only enable on a trusted, isolated host.
   */
  allowRuntimeUrlOverride: coercedBool.default(false),
  /** Maximum HTTP request body size accepted by the RPC endpoint, in bytes. */
  maxRequestBodyBytes: z.coerce.number().int().positive().default(1_048_576), // 1 MiB
  /**
   * Allow-listed workspace roots for the filesystem jail. Every file /
   * project operation must canonicalize to a descendant of one of these
   * roots. Provide as a comma-separated env var.
   *
   * If omitted, the jail runs in "open" mode (logs a warning, gates only
   * `..`-style traversal, lets paths land anywhere). This is acceptable
   * for single-developer local hosts but MUST be configured for any
   * shared / production deployment.
   */
  workspaceAllowedRoots: csvList.pipe(z.array(z.string().min(1)).default([])),
  /**
   * Origins permitted by the CORS allowlist. Browser shells must be served
   * from one of these. Default mirrors the local Vite dev server
   * (`apps/web` runs on `:3000`, see `apps/web/vite.config.ts`) + the
   * server's own port (so direct `curl` calls keep working).
   */
  corsAllowedOrigins: csvList.pipe(
    z
      .array(z.string().url())
      .default(['http://localhost:3000', 'http://localhost:3001']),
  ),
  /** Pino log level. */
  logLevel: LogLevelSchema.default('info'),
  /**
   * When `true`, the pretty transport prints the full structured payload
   * instead of the compact `time | level | message` line.
   */
  verbose: coercedBool.default(false),
  /** Standard Node environment marker, surfaced in log records. */
  nodeEnv: NodeEnvSchema.default('development'),
  /** Max inbound WebSocket frame size for the LSP endpoint (bytes). */
  lspMaxMessageBytes: z.coerce.number().int().positive().default(1_048_576),
  /** Max concurrent LSP WebSocket connections. */
  lspMaxConnections: z.coerce.number().int().positive().default(8),
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
    host: process.env.HOST,
    port: process.env.PORT,
    vnextRuntimeUrl: process.env.VNEXT_RUNTIME_URL,
    runtimeAllowedBaseUrls: process.env.RUNTIME_ALLOWED_BASE_URLS,
    allowRuntimeUrlOverride: process.env.ALLOW_RUNTIME_URL_OVERRIDE,
    maxRequestBodyBytes: process.env.MAX_REQUEST_BODY_BYTES,
    workspaceAllowedRoots: process.env.WORKSPACE_ALLOWED_ROOTS,
    corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
    logLevel: process.env.LOG_LEVEL,
    verbose: process.env.VERBOSE,
    nodeEnv: process.env.NODE_ENV,
    lspMaxMessageBytes: process.env.LSP_MAX_MESSAGE_BYTES,
    lspMaxConnections: process.env.LSP_MAX_CONNECTIONS,
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
        `host=${parsed.data.host}, port=${parsed.data.port}, ` +
        `vnextRuntimeUrl=${parsed.data.vnextRuntimeUrl}, ` +
        `logLevel=${parsed.data.logLevel}, nodeEnv=${parsed.data.nodeEnv}. ` +
        'Create apps/server/.env to override.',
    );
  }

  // Loud warning when bound to a non-loopback interface — capability gating
  // (see services-core registry/policy) tightens its rules in that mode and
  // the deployer needs to know they have left the local-only trust model.
  if (!isLoopbackHost(parsed.data.host)) {
    console.warn(
      `[vnext-forge/server] HOST=${parsed.data.host} is NOT loopback. ` +
        'Capability gating will deny privileged REST methods (files/*, ' +
        'runtime/proxy, projects/create|import|remove, files/browse) unless ' +
        'the request originates from an allow-listed origin. Make sure ' +
        'CORS_ALLOWED_ORIGINS is correct for your deployment.',
    );
  }

  return parsed.data;
}

/**
 * Re-export the shared loopback predicate so existing callers keep their
 * `import { isLoopbackHost } from './config.js'` path working. Implementation
 * lives in `@vnext-forge/app-contracts/env/common.ts` (R-b7).
 */
export const isLoopbackHost = isLoopbackHostShared;

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
