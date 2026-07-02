# vNext Monitoring App — Proje İskeleti (Design Spec)

- **Tarih:** 2026-06-16
- **Durum:** Onaylandı
- **Önceki:** `2026-06-16-monitoring-app-scaffold-design.md` (ilk iskelet)
- **Kapsam:** Vertical slice klasör yapısı, designer-ui entegrasyonu, HTTP transport katmanı

## Amaç

`apps/monitoring`'in ilk iskeletini (React + Vite + Tailwind) vertical slice mimarisine uygun
hale getirmek. Bu adımda sayfa içeriği veya monitoring özellikleri **yok** —
sadece klasör yapısı, bağımlılıklar ve infrastructure bileşenleri.

## Entegrasyon Stratejisi

`designer-ui` seçici import ile kullanılır, `DesignerUiProvider` kullanılmaz:

| Subpath | Kullanım |
|---|---|
| `./ui` | Button, Card, Badge, Dialog vb. 39 primitif |
| `./hooks` | useAsync, useDebounce, useDebouncedAutoSave |
| `./notification` | registerNotificationSink, showNotification |
| `./lib` | cn (clsx wrapper) |
| `./styles.css` | ✅ Zaten eklendi (`@import '@vnext-forge-studio/designer-ui/styles.css'`) |
| Default barrel | DocumentThemeSync, createLogger |

`DesignerUiProvider` forge-özgü şeyler kuruyor (LSP capabilities, forge ApiTransport,
Monaco loader). Monitoring bu şeylere ihtiyaç duymuyor.

## Transport Stratejisi

Monitoring API'leri forge yöntem kayıt sistemini (`getMethodHttpSpec`) kullanmıyor.
Bu yüzden `ApiTransport` interface'i benimsenmez. Bunun yerine:

- **`MonitoringHttpClient`** — endpoint-tabanlı basit fetch wrapper
- **`ApiResponse<T>`** envelope'u `@vnext-forge-studio/app-contracts`'tan alınır
- Envelope helpers, trace header injection → web'den yeniden kullanılır
- Base URL: `VITE_MONITORING_API_BASE_URL` (default: `http://localhost:4203`)

## Klasör Yapısı

```
apps/monitoring/src/
  app/
    AppRouter.tsx                    # BrowserRouter + Routes + route tanımları
    AppProviders.tsx                 # Provider composition (tema sync, bildirim)
    RouteErrorBoundary.tsx           # Class component error boundary
    notifications/
      SonnerProvider.tsx             # registerNotificationSink → sonner toast
  modules/                           # Vertical slice'lar buraya (ileride)
    README.md                        # Konvansiyon notu
  pages/
    HomePage.tsx                     # Landing sayfası (güncellenir)
    NotFoundPage.tsx                 # 404
  shared/
    api/
      api-envelope.ts                # isApiResponseShape, buildEnvelopeFailure, helpers
      api-client.ts                  # MonitoringHttpClient (get / post)
      trace-headers.ts               # X-Trace-Id + traceparent outbound headers
    config/
      config.ts                      # VITE_MONITORING_API_BASE_URL env
    lib/
      utils.ts                       # cn re-export
```

## Konfigürasyon Değişiklikleri

| Dosya | Değişiklik |
|---|---|
| `package.json` | Workspace deps + sonner + lucide-react + zustand + zod; devDeps: eslint-plugin-react-dom, eslint-plugin-react-x |
| `vite.config.ts` | `@monitoring` alias, `resolve.dedupe`, `optimizeDeps.exclude` |
| `tsconfig.json` | app-contracts, designer-ui, vnext-types references |
| `eslint.config.js` | react-dom ve react-x plugin'leri |
| `vite-env.d.ts` | `VITE_MONITORING_API_BASE_URL` tanımı |

## Doğrulama Kriterleri

1. `corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit` → 0 hata
2. `corepack pnpm --filter @vnext-forge-studio/monitoring dev` → `localhost:3100` açılır
3. `DocumentThemeSync` mount edilmiş, tema tokenleri çalışıyor
4. `SonnerProvider` notification sink'i kayıtlı

## Kapsam Dışı

- Gerçek monitoring endpoint'leri ve API method tanımları
- Slice store'ları (zustand), slice UI'ları
- Auth / layout / navigation
