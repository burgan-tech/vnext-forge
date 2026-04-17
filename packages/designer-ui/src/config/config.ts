import { z } from 'zod';
import { createLogger } from '../lib/logger/createLogger';

const logger = createLogger('config');

const APP_ENVIRONMENTS = ['DEVELOPMENT', 'PRODUCTION', 'TEST'] as const;
const appEnvironmentSchema = z.enum(APP_ENVIRONMENTS);

type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

const DEFAULTS = {
  API_URL: 'https://api.example.com/api',
  API_URL_DEVELOPMENT: 'http://localhost:8080/api',
  ENVIRONMENT: 'DEVELOPMENT' as AppEnvironment,
  RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: 30,
} as const;

const rawStringSchema = z.string().trim().min(1);
const urlSchema = rawStringSchema.url();
const positiveIntegerSchema = z.coerce.number().int().positive();

const appConfigSchema = z.object({
  ENVIRONMENT: appEnvironmentSchema,
  API_URL: urlSchema,
  API_URL_DEVELOPMENT: urlSchema,
  API_BASE_URL: urlSchema,
  RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: positiveIntegerSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;

// Shape injected by the VS Code extension host via window.__VNEXT_CONFIG__.
// Only the fields actually consumed by the web app need to be present.
interface VscodeWebviewConfig {
  ENVIRONMENT?: string;
  API_URL?: string;
  API_URL_DEVELOPMENT?: string;
  RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS?: number;
}

declare global {
  interface Window {
    __VNEXT_CONFIG__?: VscodeWebviewConfig;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getImportMetaEnv(): Record<string, unknown> {
  const importMetaValue: unknown = import.meta;

  if (!isRecord(importMetaValue)) {
    return {};
  }

  const env = importMetaValue.env;
  return isRecord(env) ? env : {};
}

/**
 * Returns a flat config bag that merges the VS Code webview injection
 * (`window.__VNEXT_CONFIG__`) over the standard Vite env variables.
 * The injected values take precedence so the extension host can override
 * VITE_* defaults without rebuilding the bundle.
 */
function getRawConfig(): Record<string, unknown> {
  const metaEnv = getImportMetaEnv();

  const injected: Record<string, unknown> = {};
  const windowConfig =
    typeof window !== 'undefined' ? window.__VNEXT_CONFIG__ : undefined;
  if (isRecord(windowConfig)) {
    if (windowConfig.ENVIRONMENT !== undefined)
      injected.VITE_ENVIRONMENT = windowConfig.ENVIRONMENT;
    if (windowConfig.API_URL !== undefined)
      injected.VITE_API_URL = windowConfig.API_URL;
    if (windowConfig.API_URL_DEVELOPMENT !== undefined)
      injected.VITE_API_URL_DEVELOPMENT = windowConfig.API_URL_DEVELOPMENT;
    if (windowConfig.RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS !== undefined)
      injected.VITE_RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS =
        windowConfig.RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS;
  }

  return { ...metaEnv, ...injected };
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function warnFallback(key: string, fallback: string | number, value: unknown): void {
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
  normalize?: (input: unknown) => unknown,
): T {
  const candidate = normalize ? normalize(value) : value;
  const result = schema.safeParse(candidate);

  if (result.success) {
    return result.data;
  }

  warnFallback(key, typeof fallback === 'string' ? fallback : String(fallback), value);
  return fallback;
}

const env = getRawConfig();

const environment = parseEnvField(
  'VITE_ENVIRONMENT',
  env.VITE_ENVIRONMENT,
  appEnvironmentSchema,
  DEFAULTS.ENVIRONMENT,
  (value) => normalizeString(value)?.toUpperCase(),
);

const apiUrl = parseEnvField(
  'VITE_API_URL',
  env.VITE_API_URL,
  urlSchema,
  DEFAULTS.API_URL,
  normalizeString,
);

const apiUrlDevelopment = parseEnvField(
  'VITE_API_URL_DEVELOPMENT',
  env.VITE_API_URL_DEVELOPMENT,
  urlSchema,
  DEFAULTS.API_URL_DEVELOPMENT,
  normalizeString,
);

const runtimeRevalidationMinIntervalSeconds = parseEnvField(
  'VITE_RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS',
  env.VITE_RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS,
  positiveIntegerSchema,
  DEFAULTS.RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS,
);

export const APP_CONFIG = Object.freeze(
  appConfigSchema.parse({
    ENVIRONMENT: environment,
    API_URL: apiUrl,
    API_URL_DEVELOPMENT: apiUrlDevelopment,
    API_BASE_URL: environment === 'DEVELOPMENT' ? apiUrlDevelopment : apiUrl,
    RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS: runtimeRevalidationMinIntervalSeconds,
  }),
);

