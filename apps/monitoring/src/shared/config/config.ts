const rawApiBaseUrl = import.meta.env.VITE_MONITORING_API_BASE_URL;
const rawDomain = import.meta.env.VITE_MONITORING_DOMAIN;

if (!rawApiBaseUrl) {
  console.warn(
    '[monitoring] VITE_MONITORING_API_BASE_URL is not set — defaulting to http://localhost:4203',
  );
}

if (!rawDomain) {
  console.warn('[monitoring] VITE_MONITORING_DOMAIN is not set — defaulting to banking');
}

export const config = {
  apiBaseUrl: rawApiBaseUrl ?? 'http://localhost:4203',
  domain: rawDomain ?? 'banking',
} as const;
