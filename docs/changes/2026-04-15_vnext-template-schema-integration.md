# vnext-template ve vnext-schema Entegrasyonu

**Tarih:** 2026-04-15  
**Kapsam:** Server + Web  
**Ilgili paketler:** `@burgan-tech/vnext-template@^0.0.7`, `@burgan-tech/vnext-schema@^0.0.39`, `ajv@^8.12.0`, `ajv-formats@^2.1.1`

---

## Amac

1. Proje olusturma akisini `vnext-template` paketi uzerinden yapmak (eski manual mkdir + writeFile yerine).
2. Component JSON dosyalarini `vnext-schema` + AJV ile gercek zamanda validate etmek.
3. Monaco editor'de JSON schema linting saglamak.
4. StatusBar'da validate.js eksikligi ve schema validation hatalarini gostermek.

---

## Server Degisiklikleri (`apps/server`)

### Bagimliliklar (`package.json`)

- `ajv`, `ajv-formats`, `@burgan-tech/vnext-schema`, `@burgan-tech/vnext-template` **devDependencies'ten dependencies'e tasinarak** runtime'da kullanilabilir hale getirildi.

### Template Slice — Yeniden Yapilandirildi

| Dosya | Degisiklik |
|---|---|
| `slices/template/catalog.ts` | **Silindi** — statik `workflowTemplateCatalog` artik kullanilmiyordu. |
| `slices/template/service.ts` | **Yeni** — `TemplateService` sinifi. |
| `slices/template/controller.ts` | **Yeniden yazildi** — `seedTemplate` handler. |
| `slices/template/router.ts` | **Yeniden yazildi** — `POST /api/templates/seed`. |
| `slices/template/schema.ts` | **Yeniden yazildi** — Zod request schemasi. |

#### TemplateService Metodlari

- **`scaffoldFromTemplate(targetDir, domainName, traceId?)`**: `npx @burgan-tech/vnext-template <domain-name>` ile ayni sekilde calisir. Paketin `init.js` dosyasini `child_process.execFile` ile dogrudan calistirir. `init.js` tum dosyalari kopyalar, `{domainName}` placeholder'larini degistirir ve `npm install` calistirir. Sonuc, CLI ile olusturulan projeyle birebir aynidir.
- **`applyCustomConfig(targetDir, domainName, customConfig, traceId?)`**: Template'in default klasor isimlerini (`Tasks`, `Views`, `Functions`, `Extensions`, `Workflows`, `Schemas`) kullanicinin custom `vnext.config.json`'undaki path'lerle karsilastirir; farkli olanlari `fs.rename` ile yeniden adlandirir ve custom config'i ust yazar.
- **`checkValidateScript(projectPath)`**: Proje dizininde `validate.js` dosyasinin var olup olmadigini kontrol eder.

### Validate Slice — Gercek AJV Validasyonu

| Dosya | Degisiklik |
|---|---|
| `slices/validate/service.ts` | **Tamamen yeniden yazildi** — Eski stub (her zaman `{ valid: true }`) yerine gercek AJV validasyonu. |
| `slices/validate/controller.ts` | **Genisletildi** — `validateComponent`, `getSchemas`, `getSchemaByType` handler'lari. |
| `slices/validate/router.ts` | **Genisletildi** — 3 yeni endpoint. |
| `slices/validate/schema.ts` | **Genisletildi** — `validateComponentRequestSchema`, `schemaByTypeRequestSchema`. |

#### Yeni Endpoint'ler

| Metod | Yol | Aciklama |
|---|---|---|
| `POST` | `/api/validate/component` | `{ content, type }` body'si ile component JSON'unu AJV'ye karsi validate eder. |
| `GET` | `/api/validate/schemas` | Tum vnext-schema tiplerini ve JSON schema iceriklerini doner. |
| `GET` | `/api/validate/schemas/:type` | Tek bir schema tipini doner. |

#### AJV Konfigurasyonu

- `strict: false`, `allErrors: true`, `verbose: true`
- `ajv-formats` ile format validasyonu
- Schema'nin `$schema` alanina gore dogru AJV instance secimi:
  - `draft-07` → standart `Ajv`
  - `2019-09` → `Ajv2019`

### Project Slice — Refactor + Yeni Endpoint

| Dosya | Degisiklik |
|---|---|
| `slices/project/service.ts` | `createProject` refactor + `getValidateScriptStatus` eklendi. |
| `slices/project/controller.ts` | `getValidateScriptStatus` handler eklendi. |
| `slices/project/router.ts` | `GET /:id/validateScriptStatus` eklendi. |
| `slices/project/types.ts` | `SeedVnextComponentLayoutResult`'a `copiedFiles?: string[]` eklendi. |

#### createProject Refactoru

**Onceki:** Manual `fs.mkdir` + `buildVnextWorkspaceConfig` + `fs.writeFile`.

**Sonraki:** `TemplateService.scaffoldFromTemplate()` ile vnext-template sablonundan proje olusturma, ardindan `createDefaultConfig` ile config yazma.

#### seedVnextComponentLayoutFromConfig Refactoru

**Onceki:** Sadece eksik klasorleri `fs.mkdir` ile olusturuyordu.

**Sonraki:** `TemplateService.scaffoldFromTemplate()` + `applyCustomConfig()` ile tam proje dosyalarini olusturur ve custom config override uygular.

---

## Web Degisiklikleri (`apps/web`)

### Yeni Dosyalar

| Dosya | Aciklama |
|---|---|
| `modules/code-editor/editor/JsonSchemaRegistry.ts` | Server'dan schemalari fetch eder ve memory'de cache'ler. |
| `modules/code-editor/editor/JsonSchemaSetup.ts` | Monaco JSON diagnostics'i konfigure eder; dinamik `fileMatch` pattern'leri olusturur. |
| `app/store/useEditorValidationStore.ts` | Aktif dosyanin Monaco marker'larini (error/warning/info) tutar. |

### Guncellenen Dosyalar

| Dosya | Degisiklik |
|---|---|
| `modules/code-editor/editor/MonacoSetup.ts` | `setupMonaco` icinde `configureJsonSchemaValidation` cagrisi eklendi. |
| `modules/code-editor/editor/CodeEditorPanel.tsx` | Monaco marker izleme (`onDidChangeMarkers`), `useEditorValidationStore`'a yazma ve vnextConfig degisiminde schema guncelleme eklendi. |
| `app/layouts/ui/StatusBar.tsx` | validate.js eksik uyarisi + editor schema validation hatalari popover'da gosteriliyor. Warning sayisina editor schema uyarilari dahil ediliyor. |
| `app/store/useVnextWorkspaceUiStore.ts` | `validateScriptMissing` state ve `setValidateScriptMissing` action eklendi. |
| `modules/project-management/ProjectApi.ts` | `getValidateScriptStatus(projectId)` endpoint cagrisi eklendi. |
| `modules/project-workspace/syncVnextWorkspaceFromDisk.ts` | Proje yuklendiginde validate.js varlik kontrolu eklendi. |
| `modules/project-workspace/components/VnextTemplateSeedDialog.tsx` | Mesajlar vnxt-template kullanimini yansitacak sekilde guncellendi. |

### Monaco JSON Schema Validasyonu — Detay

- Server'daki `GET /api/validate/schemas` endpoint'inden tum schema JSON'lari bir kere fetch edilip cache'lenir.
- `monaco.languages.json.jsonDefaults.setDiagnosticsOptions()` ile her schema tipi icin dinamik `fileMatch` pattern'leri olusturulur.
- Pattern'ler aktif projenin `vnext.config.json` paths degerlerine gore turetilir (ornegin `paths.workflows = "Workflows"` ise `**/Workflows/**/*.json`).
- Monaco'nun dahili JSON validasyonu real-time calisir; **ekstra debounce gerekmez**.
- `onDidChangeMarkers` event'i ile marker'lar `useEditorValidationStore`'a yazilir.
- StatusBar bu store'dan okuyarak hata ve uyari sayisini gosterir.

### StatusBar Yeni Gosterimleri

| Durum | Gosterim |
|---|---|
| `validate.js` eksik | Error popover item: "validate.js dosyasi bulunamadi. Proje sablonunu yeniden olusturun." |
| Schema validation hatalari | Error popover item: Her hata satir numarasi ile gosterilir. |
| Schema validation uyarilari | Warning chip sayisina dahil edilir. |

---

## Teknik Kararlar

1. **npm install**: vnext-template `init.js` calistirildiginda otomatik olarak `npm install` calistirir. Bu projenin kendi bagimliklarini (`@burgan-tech/vnext-schema` vb.) yukler.
2. **Schema transport**: vnext-schema dosyalari server'da; Monaco client'ta. Schema JSON'lari bir kere fetch edilip cache'lenir.
3. **Debounce**: Monaco `setDiagnosticsOptions` ile JSON schema validasyonu dahili olarak optimize edilmistir. Ekstra debounce gerekmez.
4. **Template override stratejisi**: vnxt-template once default yapisiyla olusturur, sonra custom config override edilir. Bu siralama onemli cunku template'in `{domainName}` replacement mantigi once calismali.

---

## Akis Diyagrami

```
Proje Olusturma Akisi:
  createProject() 
    → TemplateService.scaffoldFromTemplate() 
    → vnext-template dosyalarini kopyala 
    → createDefaultConfig() ile config yaz

Sablon Olusturma (bos proje):
  CreateVnextConfigDialog → vnext.config.json yaz
    → syncVnextWorkspaceFromDisk → layout status kontrol
    → VnextTemplateSeedDialog ac
    → seedVnextComponentLayoutFromConfig
      → TemplateService.scaffoldFromTemplate()
      → TemplateService.applyCustomConfig()

Monaco Validasyonu:
  setupMonaco → configureJsonSchemaValidation
    → fetchVnextSchemas (GET /api/validate/schemas)
    → monaco.languages.json.jsonDefaults.setDiagnosticsOptions
    → onDidChangeMarkers → useEditorValidationStore
    → StatusBar hatalari gosterir

validate.js Kontrolu:
  syncVnxtWorkspaceFromDisk
    → getValidateScriptStatus (GET /api/projects/:id/validateScriptStatus)
    → useVnextWorkspaceUiStore.setValidateScriptMissing
    → StatusBar uyari gosterir
```
