# Web Vertical Slice Migration Plan

## Durum

Bu doküman `apps/web` için aktif mimari referanstır. Web uygulamasının hedef yapısı `app / pages / modules / shared` düzenidir. `entities / features / widgets / routes / stores / hooks / components` gibi yatay sahiplik alanları yeni geliştirmelerde kullanılmaz.

## Hedef Yapı

```text
src/
  app/
  pages/
  modules/
  shared/
```

Kurallar:

- `app` uygulama shell'i, provider'lar ve route registration sahibidir.
- `pages` route entry ve composition sahibidir.
- `modules` business UI, module-local state, service ve adapter sahibidir.
- `shared` yalnızca generic UI primitive, config, RPC helper ve utility içerir.
- Kararsız kalınan durumda sahiplik `modules` altında çözülür.

## Migration Haritası

### Project management

- `entities/project/*`
- `features/project-list/*`
- `features/create-project/*`
- `features/import-project/*`
- `features/delete-project/*`
- `widgets/project-list-*`

Hedef:

- `modules/project-management/*`
- `pages/project-list/*`

Sahiplik:

- proje listeleme
- create/import/delete akışları
- proje store/state
- proje API erişimi
- liste UI ve dialog orchestration

### Project workspace

- `entities/workspace/*`
- `widgets/file-tree/*`
- `pages/project-workspace/model/*`

Hedef:

- `modules/project-workspace/*`
- `pages/project-workspace/*`

Sahiplik:

- aktif proje/workspace state
- file tree orchestration
- dosya route çözümleme
- workspace service çağrıları
- sidebar verisi ve workspace-level UI

### Editor ve workflow alanları

Hedef modül owner'ları:

- `modules/canvas-interaction/*`
- `modules/code-editor/*`
- `modules/workflow-validation/*`
- `modules/workflow-execution/*`
- `modules/save-workflow/*`
- `modules/save-component/*`
- `modules/task-editor/*`
- `modules/function-editor/*`
- `modules/extension-editor/*`
- `modules/schema-editor/*`
- `modules/view-editor/*`

Legacy alan eşlemeleri:

- `canvas/*` -> `modules/canvas-interaction/*`
- `editor/*` -> `modules/code-editor/*`
- `validation/*` ve `stores/validation-store.ts` -> `modules/workflow-validation/*`
- `task-editor/*` -> `modules/task-editor/*`
- `function-editor/*` -> `modules/function-editor/*`
- `extension-editor/*` -> `modules/extension-editor/*`
- `schema-editor/*` -> `modules/schema-editor/*`
- `view-builder/*` -> `modules/view-editor/*`
- `hooks/useSaveWorkflow.ts` -> `modules/save-workflow/*`
- `hooks/useSaveComponent.ts` -> `modules/save-component/*`

## Import ve Bagimlilik Kurallari

Izin verilen yon:

- `app` -> `pages`, `modules`, `shared`
- `pages` -> `modules`, `shared`
- `modules` -> `shared`
- `shared` -> yalnizca kendi alti ve `packages/*`

Kullanilmamasi gereken alias'lar:

- `@entities`
- `@features`
- `@widgets`

Web tarafinda yeni endpoint erisimi module owner service dosyasinda konumlanir. UI bilesenleri dogrudan raw `fetch` cagrisi yapmaz.

## Shared Siniri

`shared` altinda yalnizca su alanlar tutulur:

- generic UI primitive
- Hono RPC client helper
- env/config/constants
- logger
- generic utility

Sunlar `shared` altinda tutulmaz:

- project-specific API ve store
- workspace-specific router/helper
- file tree orchestration
- workflow editor business logic
- validation business logic

## Temizlik Kurallari

- `entities`, `features`, `widgets`, `routes`, `stores`, `hooks`, `components` altinda yeni dosya acilmaz.
- Business state owning module ile ayni alanda tutulur.
- Route dosyalari ikinci bir business owner'a donusmez.
- Gerekmedikce `model`, `ui`, `hooks`, `types` gibi alt klasorler refleks olarak acilmaz.

## Eski Dokumanlar

Asagidaki dokumanlar obsolete kabul edilir:

- `docs/plans/new-architecture.md`
- `docs/plans/skills-refactor-plan.md`

Bu iki dosya yalnizca tarihsel baglam icin tutulur. Guncel referans bu dokumandir.
