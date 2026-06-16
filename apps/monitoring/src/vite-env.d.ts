/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONITORING_API_BASE_URL?: string;
  readonly VITE_MONITORING_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
