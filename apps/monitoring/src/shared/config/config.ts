const rawApiBaseUrl = import.meta.env.VITE_MONITORING_API_BASE_URL;
const rawDomain = import.meta.env.VITE_MONITORING_DOMAIN;

if (!rawDomain) {
  console.warn('[monitoring] VITE_MONITORING_DOMAIN is not set — defaulting to core');
}

export const config = {
  // Empty string = relative URL → Vite proxy forwards /api/* to localhost:4203 (dev)
  // Set VITE_MONITORING_API_BASE_URL for direct backend access in production
  apiBaseUrl: rawApiBaseUrl ?? '',
  domain: rawDomain ?? 'core',
} as const;
