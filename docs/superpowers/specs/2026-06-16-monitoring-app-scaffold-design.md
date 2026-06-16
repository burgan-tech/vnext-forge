# vNext Monitoring Web App — İlk İskelet (Design Spec)

- **Tarih:** 2026-06-16
- **Durum:** Onaylandı
- **Kapsam:** Sadece ilk oluşturma adımı — iskelet + bağımlılıklar + çalışan açılış sayfası

## Amaç

vNext kullanıcılarına monitoring hizmetleri sunacak standalone bir web uygulamasının
monorepo (`vnext-forge`) içinde ilk kez ayağa kaldırılması. Bu adımda sadece çalışan bir
iskelet ve basit bir açılış sayfası hedefleniyor; iş mantığı/monitoring özellikleri sonraki
adımlara bırakılıyor.

## Kararlar

- **Şablon:** `apps/web` kalıbı (standalone Vite + React 19 + Tailwind 4). VS Code eklentisi
  olan `apps/extension` değil — istenen saf web uygulaması.
- **Bağımlılık kapsamı:** Minimal. Workspace paketleri (designer-ui, monaco, zustand,
  mermaid vb.) bu adımda dahil edilmez.
- **Konum/İsim:** `apps/monitoring`, paket adı `@vnext-forge-studio/monitoring`.
  `pnpm-workspace.yaml`'daki `apps/*` glob'u sayesinde otomatik dahil olur.
- **Port:** Dev server `3100` (web app `3000`'i kullanıyor, çakışmayı önlemek için).

## Stack

- React 19 + react-dom 19
- react-router-dom 7
- Vite 6.4 + `@vitejs/plugin-react`
- Tailwind 4 (`@tailwindcss/vite`) + `tw-animate-css`
- TypeScript 5.7 (`tsconfig.base.json` extend)
- ESLint (kök config + web app eslint kalıbı)

## Dosya Yapısı

```
apps/monitoring/
  package.json          # dev/build/lint/preview/clean scriptleri
  index.html            # title: "vNext Monitoring"
  vite.config.ts        # react + tailwind plugin, server.port: 3100
  tsconfig.json         # base'i extend eder, jsx: react-jsx
  eslint.config.js      # web'inkiyle aynı
  .gitignore
  src/
    main.tsx            # createRoot → <App/>
    index.css           # tailwind + tw-animate-css import
    vite-env.d.ts
    App.tsx             # BrowserRouter + tek route (/)
    pages/HomePage.tsx  # "vNext Monitoring" açılış sayfası
```

## Açılış Sayfası

Tailwind ile stillenmiş tek bir landing sayfası: "vNext Monitoring" başlığı ve kısa bir
açıklama. Router kurulu fakat tek route (`/`); ileride dashboard/alert sayfaları için hazır
zemin.

## Doğrulama

1. `pnpm install` — bağımlılıklar inilir.
2. `pnpm --filter @vnext-forge-studio/monitoring dev` — dev server ayağa kalkar.
3. `http://localhost:3100` açılış sayfasını gösterir.

## Kapsam Dışı (Sonraki Adımlar)

- Gerçek monitoring özellikleri (dashboard, metrikler, alert'ler)
- Workspace paket entegrasyonları (designer-ui, transport, services-core)
- Auth, API entegrasyonu, state yönetimi (zustand)
