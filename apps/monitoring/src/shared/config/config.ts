const rawApiBaseUrl = import.meta.env.VITE_MONITORING_API_BASE_URL;

if (!rawApiBaseUrl) {
  console.warn(
    '[monitoring] VITE_MONITORING_API_BASE_URL is not set — defaulting to http://localhost:4203',
  );
}

export const config = {
  apiBaseUrl: rawApiBaseUrl ?? 'http://localhost:4203',
} as const;
