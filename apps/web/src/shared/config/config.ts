import { z } from 'zod';
import { createLogger } from '@shared/lib/logger/createLogger';

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

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function warnFallback(key: string, fallback: string | number, value: unknown): void {
  if (env.DEV === true) {
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

const env = getImportMetaEnv();

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

