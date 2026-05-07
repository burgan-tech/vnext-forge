import { z } from 'zod';

/**
 * Centralized, validated runtime configuration for `@vnext-forge-studio/web`.
 *
 * Single source of truth for every env-driven setting:
 *  - Defaults are baked into the Zod schema, so the SPA boots even when no
 *    `.env` file is present.
 *  - When a `.env` file exists at the workspace root, Vite inlines the
 *    `VITE_*` keys into `import.meta.env` at build time, and those overrides
 *    win over the defaults below.
 *  - Validation happens once, at module load. Any typed access goes through
 *    the exported `config` singleton.
 *  - The resolved object is also attached to `globalThis.__vnextConfig` (i.e.
 *    `window.__vnextConfig` in the browser) so it can be inspected from dev
 *    tools without an extra import.
 *
 * NOTE: Only `VITE_*`-prefixed keys are exposed to the browser bundle. Any
 * non-prefixed env vars in `.env` will be ignored by Vite by design.
 */

/**
 * Mode-aware default for the Hono web-server base URL.
 *  - In dev the SPA runs on http://localhost:3000 (Vite) and the API on
 *    http://localhost:3001 (Hono), so we need a fully-qualified URL.
 *  - In production the SPA is expected to be served from the same origin as
 *    the API, so the empty string yields same-origin `/api/v1/*` requests.
 */
const defaultApiBaseUrl = import.meta.env.DEV ? 'http://localhost:3001' : '';

const ConfigSchema = z.object({
  /** Base URL of the Hono API server (`${apiBaseUrl}/api/v1/*` REST surface). */
  apiBaseUrl: z.string().default(defaultApiBaseUrl),
  /** Standard build-mode markers, surfaced for convenience. */
  isDev: z.boolean(),
  isProd: z.boolean(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

function loadConfig(): AppConfig {
  const env = import.meta.env;

  const parsed = ConfigSchema.safeParse({
    apiBaseUrl: env.VITE_API_BASE_URL,
    isDev: env.DEV,
    isProd: env.PROD,
  });

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid web configuration:\n${formatted}`);
  }

  if (env.DEV && !env.VITE_API_BASE_URL) {
    console.warn(
      `[vnext-forge-studio/web] VITE_API_BASE_URL not set — using built-in default "${defaultApiBaseUrl}". ` +
        'Create apps/web/.env (e.g. `VITE_API_BASE_URL=http://localhost:3001`) to override.',
    );
  }

  return parsed.data;
}

/**
 * Validated application configuration. Import this object anywhere in the
 * web app instead of reading `import.meta.env` directly.
 */
export const config: AppConfig = loadConfig();

// Expose a read-only reference on globalThis for dev-tools / REPL inspection.
// Not intended to be read by application code — always import `config`.
declare global {
  var __vnextConfig: AppConfig | undefined;
}
globalThis.__vnextConfig = config;
