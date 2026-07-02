# Monitoring App Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/monitoring` uygulamasını vertical slice iskeletine (app / modules / pages / shared) dönüştürmek; `designer-ui` entegrasyonunu, HTTP transport katmanını ve temel provider zincirini kurmak.

**Architecture:** `designer-ui` seçici subpath import ile kullanılır (`DesignerUiProvider` kullanılmaz). Monitoring API'leri için `ApiResponse<T>` envelope'unu yeniden kullanan endpoint-tabanlı `MonitoringHttpClient` yazılır. Provider zinciri: tema sync → bildirim sink → router.

**Tech Stack:** React 19, Vite 6.4, Tailwind 4, TypeScript 5.7, react-router-dom 7, sonner, zustand, zod, lucide-react — `@vnext-forge-studio/designer-ui`, `app-contracts`, `vnext-types` (workspace).

---

### Task 1: package.json — Bağımlılıkları Güncelle + Install

**Files:**
- Modify: `apps/monitoring/package.json`

- [ ] **Step 1: package.json'u güncelle**

`apps/monitoring/package.json` dosyasını şu içerikle değiştir:

```json
{
  "name": "@vnext-forge-studio/monitoring",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@vnext-forge-studio/app-contracts": "workspace:*",
    "@vnext-forge-studio/designer-ui": "workspace:*",
    "@vnext-forge-studio/vnext-types": "workspace:*",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0",
    "sonner": "^2.0.7",
    "zod": "^4.3.6",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "eslint-plugin-react-dom": "^4.2.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "eslint-plugin-react-x": "^4.2.1",
    "tailwindcss": "^4.0.0",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.4.2"
  }
}
```

- [ ] **Step 2: Bağımlılıkları kur**

Repo kökünden (`vnext-forge/`):

```bash
corepack pnpm install
```

Beklenen: `Done in ...s` — hata yok.

---

### Task 2: Build Konfigürasyonu — vite, tsconfig, vite-env, eslint

**Files:**
- Modify: `apps/monitoring/vite.config.ts`
- Modify: `apps/monitoring/tsconfig.json`
- Modify: `apps/monitoring/src/vite-env.d.ts`
- Modify: `apps/monitoring/eslint.config.js`

- [ ] **Step 1: vite.config.ts'yi güncelle**

```typescript
import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  resolve: {
    alias: {
      '@monitoring': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@vnext-forge-studio/designer-ui/editor'],
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  server: {
    port: 3100,
  },
});
```

- [ ] **Step 2: tsconfig.json'u güncelle**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": true,
    "paths": {
      "@monitoring/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/app-contracts" },
    { "path": "../../packages/designer-ui" },
    { "path": "../../packages/vnext-types" }
  ]
}
```

- [ ] **Step 3: vite-env.d.ts'yi güncelle**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONITORING_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: eslint.config.js'yi güncelle**

```javascript
import reactDom from 'eslint-plugin-react-dom';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactX from 'eslint-plugin-react-x';

import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'browser',
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      ...reactX.configs['recommended-type-checked'],
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      ...reactDom.configs.recommended,
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      ...reactHooks.configs.flat['recommended-latest'],
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      ...reactRefresh.configs.vite,
    },
  ],
});
```

---

### Task 3: Shared — Config ve Lib

**Files:**
- Create: `apps/monitoring/src/shared/config/config.ts`
- Create: `apps/monitoring/src/shared/lib/utils.ts`

- [ ] **Step 1: config.ts oluştur**

```typescript
const rawApiBaseUrl = import.meta.env.VITE_MONITORING_API_BASE_URL;

if (!rawApiBaseUrl) {
  console.warn(
    '[monitoring] VITE_MONITORING_API_BASE_URL is not set — defaulting to http://localhost:4203',
  );
}

export const config = {
  apiBaseUrl: rawApiBaseUrl ?? 'http://localhost:4203',
} as const;
```

Not: `no-console` kuralı bu dosyaya uygulanmaz (başlangıç uyarısı). ESLint config'de bu dosyayı `loggerConsoleFiles` listesine eklemeyi düşünebilirsiniz.

- [ ] **Step 2: utils.ts oluştur**

```typescript
export { cn } from '@vnext-forge-studio/designer-ui/lib';
```

---

### Task 4: Shared — API Katmanı

**Files:**
- Create: `apps/monitoring/src/shared/api/trace-headers.ts`
- Create: `apps/monitoring/src/shared/api/api-envelope.ts`
- Create: `apps/monitoring/src/shared/api/api-client.ts`

- [ ] **Step 1: trace-headers.ts oluştur**

Web app'teki `apps/web/src/shared/api/trace-headers.ts` ile birebir aynı:

```typescript
function randomSpanIdHex(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildOutboundTraceHeaders(): {
  'X-Trace-Id': string;
  traceparent: string;
} {
  const xTraceId = crypto.randomUUID();
  const traceId32 = xTraceId.replace(/-/g, '');
  const spanId16 = randomSpanIdHex();
  const traceparent = `00-${traceId32}-${spanId16}-01`;
  return { 'X-Trace-Id': xTraceId, traceparent };
}

export function createTraceInjectingFetch(baseFetch: typeof fetch): typeof fetch {
  return (input, init) => {
    const trace = buildOutboundTraceHeaders();
    const nextInit: RequestInit = { ...init };
    const headers = new Headers(init?.headers);
    headers.set('X-Trace-Id', trace['X-Trace-Id']);
    headers.set('traceparent', trace.traceparent);
    nextInit.headers = headers;
    return baseFetch(input, nextInit);
  };
}
```

- [ ] **Step 2: api-envelope.ts oluştur**

```typescript
import {
  ERROR_CODES,
  type ApiResponse,
  type ErrorCode,
  type ResponseError,
} from '@vnext-forge-studio/app-contracts';

export function isApiResponseShape(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.success === 'boolean' && 'data' in candidate && 'error' in candidate;
}

export function httpStatusToErrorCode(status: number): ErrorCode {
  if (status === 400) return ERROR_CODES.API_BAD_REQUEST;
  if (status === 401) return ERROR_CODES.API_UNAUTHORIZED;
  if (status === 403) return ERROR_CODES.API_FORBIDDEN;
  if (status === 404) return ERROR_CODES.API_NOT_FOUND;
  if (status === 409) return ERROR_CODES.API_CONFLICT;
  if (status === 413) return ERROR_CODES.API_PAYLOAD_TOO_LARGE;
  if (status === 422) return ERROR_CODES.API_UNPROCESSABLE;
  if (status === 429) return ERROR_CODES.API_RATE_LIMITED;
  if (status === 502 || status === 503 || status === 504)
    return ERROR_CODES.RUNTIME_CONNECTION_FAILED;
  return ERROR_CODES.API_INTERNAL_ERROR;
}

export function buildEnvelopeFailure(
  code: ErrorCode,
  message: string,
  extra?: Pick<ResponseError, 'traceId'>,
): ApiResponse<never> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(extra?.traceId ? { traceId: extra.traceId } : {}),
    },
  };
}

export function mergeTraceIdFromResponseHeader<T>(
  response: Response,
  payload: ApiResponse<T>,
): ApiResponse<T> {
  const headerTrace = response.headers.get('x-trace-id')?.trim();
  if (!headerTrace) return payload;
  if (payload.success) return payload;
  if (payload.error.traceId) return payload;
  return { ...payload, error: { ...payload.error, traceId: headerTrace } };
}
```

- [ ] **Step 3: api-client.ts oluştur**

```typescript
import type { ApiResponse } from '@vnext-forge-studio/app-contracts';

import { ERROR_CODES } from '@vnext-forge-studio/app-contracts';

import { config } from '../config/config';
import {
  buildEnvelopeFailure,
  httpStatusToErrorCode,
  isApiResponseShape,
  mergeTraceIdFromResponseHeader,
} from './api-envelope';
import { createTraceInjectingFetch } from './trace-headers';

export interface MonitoringHttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface MonitoringHttpClient {
  get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>>;
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
}

export function createMonitoringHttpClient(
  options: MonitoringHttpClientOptions = {},
): MonitoringHttpClient {
  const baseUrl = options.baseUrl ?? config.apiBaseUrl;
  const fetchWithTrace = createTraceInjectingFetch(fetch.bind(globalThis));
  const timeoutMs = options.timeoutMs ?? 30_000;

  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, string>,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    let url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {};

    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url = `${url}?${qs}`;
    }

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetchWithTrace(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return buildEnvelopeFailure(
            ERROR_CODES.RUNTIME_TIMEOUT,
            `Request timed out after ${timeoutMs}ms (${method} ${path}).`,
          ) as ApiResponse<T>;
        }
        return buildEnvelopeFailure(
          ERROR_CODES.RUNTIME_CONNECTION_FAILED,
          `Network error: ${cause instanceof Error ? cause.message : String(cause)}`,
        ) as ApiResponse<T>;
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return buildEnvelopeFailure(
          httpStatusToErrorCode(response.status),
          `Non-JSON response (HTTP ${response.status}).`,
        ) as ApiResponse<T>;
      }

      if (isApiResponseShape(payload)) {
        return mergeTraceIdFromResponseHeader(response, payload) as ApiResponse<T>;
      }

      return buildEnvelopeFailure(
        httpStatusToErrorCode(response.status),
        `Unexpected response shape (HTTP ${response.status}).`,
      ) as ApiResponse<T>;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return {
    get: (path, params) => request('GET', path, params),
    post: (path, body) => request('POST', path, undefined, body),
  };
}
```

---

### Task 5: App — Notification Provider ve AppProviders

**Files:**
- Create: `apps/monitoring/src/app/notifications/SonnerProvider.tsx`
- Create: `apps/monitoring/src/app/AppProviders.tsx`

- [ ] **Step 1: SonnerProvider.tsx oluştur**

```typescript
import { useEffect, type ReactNode } from 'react';
import { toast, Toaster, type ExternalToast } from 'sonner';

import {
  registerNotificationSink,
  resetNotificationSink,
  type NotificationKind,
  type NotificationOptions,
  type NotificationSink,
} from '@vnext-forge-studio/designer-ui/notification';

const DEFAULT_DURATION_MS = 3000;

const sonnerSink: NotificationSink = {
  show(options: NotificationOptions) {
    const opts: ExternalToast = {
      duration: options.durationMs ?? DEFAULT_DURATION_MS,
    };

    if (options.action) {
      opts.action = {
        label: options.action.label,
        onClick: options.action.onPress,
      };
    }

    dispatch(options.kind, options.message, opts);
  },
};

function dispatch(kind: NotificationKind | undefined, message: string, opts: ExternalToast) {
  switch (kind) {
    case 'success':
      toast.success(message, opts);
      return;
    case 'warning':
      toast.warning(message, opts);
      return;
    case 'error':
      toast.error(message, opts);
      return;
    case 'info':
    default:
      toast.info(message, opts);
      return;
  }
}

export function SonnerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerNotificationSink(sonnerSink);
    return () => {
      resetNotificationSink();
    };
  }, []);

  return (
    <>
      {children}
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}
```

- [ ] **Step 2: AppProviders.tsx oluştur**

```typescript
import { type ReactNode } from 'react';
import { DocumentThemeSync } from '@vnext-forge-studio/designer-ui';

import { SonnerProvider } from './notifications/SonnerProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SonnerProvider>
      <DocumentThemeSync />
      {children}
    </SonnerProvider>
  );
}
```

---

### Task 6: App — Router ve Error Boundary

**Files:**
- Create: `apps/monitoring/src/app/RouteErrorBoundary.tsx`
- Create: `apps/monitoring/src/app/AppRouter.tsx`

- [ ] **Step 1: RouteErrorBoundary.tsx oluştur**

```typescript
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@vnext-forge-studio/designer-ui';

const logger = createLogger('monitoring/RouteErrorBoundary');

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  supportRef: string | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = { error: null, supportRef: null };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      error,
      supportRef:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null,
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Route subtree render failed', { error, componentStack: info.componentStack });
  }

  private handleRetry = (): void => {
    this.setState({ error: null, supportRef: null });
  };

  public render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="text-foreground flex h-full min-h-[12rem] flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-destructive text-sm font-medium">Something went wrong in this view.</p>
          <p className="text-muted-foreground max-w-md text-xs leading-relaxed">
            {this.state.error.message}
          </p>
          {this.state.supportRef ? (
            <p className="text-muted-foreground font-mono text-[11px]">
              Reference: {this.state.supportRef}
            </p>
          ) : null}
          <button
            type="button"
            onClick={this.handleRetry}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium">
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: AppRouter.tsx oluştur**

```typescript
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { RouteErrorBoundary } from './RouteErrorBoundary';
import { HomePage } from '@monitoring/pages/HomePage';
import { NotFoundPage } from '@monitoring/pages/NotFoundPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
```

---

### Task 7: Pages ve Modules Placeholder

**Files:**
- Modify: `apps/monitoring/src/pages/HomePage.tsx`
- Create: `apps/monitoring/src/pages/NotFoundPage.tsx`
- Create: `apps/monitoring/src/modules/README.md`

- [ ] **Step 1: HomePage.tsx'i güncelle**

```typescript
export function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <span className="rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        vNext
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">vNext Monitoring</h1>
      <p className="max-w-md text-balance text-muted-foreground">
        vNext için monitoring hizmetleri burada sunulacak.
      </p>
    </main>
  );
}
```

Not: Önceki sabit `bg-slate-950 text-slate-100` renkleri kaldırıldı; `designer-ui/styles.css`'ten gelen tema token'ları kullanılıyor (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`).

- [ ] **Step 2: NotFoundPage.tsx oluştur**

```typescript
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <span className="text-6xl font-bold text-muted-foreground">404</span>
      <h1 className="text-2xl font-semibold">Page Not Found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Bu sayfa mevcut değil.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        Ana Sayfaya Dön
      </Link>
    </main>
  );
}
```

- [ ] **Step 3: modules/README.md oluştur**

```markdown
# modules/

Her monitoring özelliği bu klasörde kendi dilimi (slice) olarak yaşar.

## Konvansiyonlar

- Her dilim kendi klasöründe yaşar: `modules/<feature-name>/`
- Dilim içinde: `components/`, `hooks/`, `store.ts`, `api.ts`, `index.ts`
- Dilimler birbirini direkt import etmez; paylaşılan şeyler `shared/` altına taşınır
- `index.ts` dışına çıkan export yoktur (kapsülleme)

## Gelecek Dilimler (örnekler)

- `health/` — Runtime sağlık durumu
- `instances/` — Çalışan workflow instance'ları
- `alerts/` — Alarm ve bildirimler
- `metrics/` — Performans metrikleri
```

---

### Task 8: Ana Giriş Noktaları — App.tsx ve main.tsx

**Files:**
- Modify: `apps/monitoring/src/App.tsx`
- Modify: `apps/monitoring/src/main.tsx`

- [ ] **Step 1: App.tsx'i güncelle**

```typescript
import { AppProviders } from './app/AppProviders';
import { AppRouter } from './app/AppRouter';

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
```

- [ ] **Step 2: main.tsx'i güncelle**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

---

### Task 9: TypeScript Doğrulama + Dev Server

**Files:** (doğrulama adımı — dosya değişikliği yok)

- [ ] **Step 1: TypeScript tip kontrolü çalıştır**

Repo kökünden (`vnext-forge/`):

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Beklenen: `0` hata, 0 satır çıktı. Hata varsa Task 1–8'i gözden geçir.

- [ ] **Step 2: Dev server başlat ve sayfayı kontrol et**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring dev
```

Beklenen:
```
VITE v6.4.x  ready in ...ms
➜  Local:   http://localhost:3100/
```

Tarayıcıda `http://localhost:3100/` açılır → "vNext Monitoring" başlığı görünür, tema tokenleri çalışıyor (arka plan `bg-background` rengi).

`http://localhost:3100/nonexistent` → 404 sayfası görünür.

- [ ] **Step 3: Commit**

```bash
cd apps/monitoring
git add -A
git commit -m "feat(monitoring): vertical slice skeleton with designer-ui integration"
```
