import { z } from 'zod';
import { createLogger } from '../lib/logger/createLogger';

const logger = createLogger('config');

/**
 * Runtime configuration for the designer UI bundle.
 *
 * Background: this used to expose `API_URL` / `API_BASE_URL` /
 * `ENVIRONMENT` because an earlier shape of the codebase fetched data
 * directly from a public API. The current architecture pushes every API
 * call through `ApiTransport`, so those fields had become dead config —
 * worse, they were emitted with placeholder values like
 * `https://localhost/api` from the VS Code webview boot script, giving
 * security reviewers a false signal that the webview was talking to a
 * real HTTP endpoint.
 *
 * Today the only field the UI actually consumes is the runtime
 * revalidation interval, which is how often `useRuntimeRevalidator`
 * polls the workflow runtime for state changes. Hosts (web SPA / VS Code
 * webview) inject this through the same `window.__VNEXT_CONFIG__`
 * channel; if no host injects it the safe default below is used.
 */

const positiveIntegerSchema = z.coerce.number().int().positive();

const DEFAULTS = {
  RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: 30,
} as const;

const appConfigSchema = z.object({
  RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: positiveIntegerSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * Shape injected by the host shell via `window.__VNEXT_CONFIG__`.
 * Optional fields are intentional — every value falls back to a baked
 * default so the UI boots even when the host injects nothing.
 */
interface HostInjectedConfig {
  RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS?: number;
}

declare global {
  interface Window {
    __VNEXT_CONFIG__?: HostInjectedConfig;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getImportMetaEnv(): Record<string, unknown> {
  const importMetaValue: unknown = import.meta;
  if (!isRecord(importMetaValue)) return {};
  const env = importMetaValue.env;
  return isRecord(env) ? env : {};
}

/**
 * Returns a flat config bag that merges the host injection
 * (`window.__VNEXT_CONFIG__`) over the standard Vite env variables.
 * The injected values take precedence so the host shell can override
 * VITE_* defaults without rebuilding the bundle.
 */
function getRawConfig(): Record<string, unknown> {
  const metaEnv = getImportMetaEnv();
  const injected: Record<string, unknown> = {};
  const windowConfig = typeof window !== 'undefined' ? window.__VNEXT_CONFIG__ : undefined;
  if (isRecord(windowConfig)) {
    if (windowConfig.RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS !== undefined) {
      injected.VITE_RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS =
        windowConfig.RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS;
    }
  }
  return { ...metaEnv, ...injected };
}

function warnFallback(key: string, fallback: number, value: unknown): void {
  const metaEnv = getImportMetaEnv();
  if (metaEnv.DEV === true) {
    logger.warn(`Invalid or missing ${key}. Falling back to default.`, {
      key,
      fallback,
      received: value,
    });
  }
}

function parseEnvField<T>(
  key: string,
  value: unknown,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  warnFallback(key, typeof fallback === 'number' ? fallback : Number(fallback), value);
  return fallback;
}

const env = getRawConfig();

const runtimeRevalidationMinIntervalSeconds = parseEnvField(
  'VITE_RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS',
  env.VITE_RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS,
  positiveIntegerSchema,
  DEFAULTS.RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS,
);

export const APP_CONFIG = Object.freeze(
  appConfigSchema.parse({
    RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: runtimeRevalidationMinIntervalSeconds,
  }),
);
