# Server Instructions

## Logging

- Server tarafinda dogrudan `console.log`, `console.error`, `console.warn` veya diger `console.*` cagrilarini kullanma.
- Tum loglar merkezi logger uzerinden akmalidir: request icinde `c.get('logger')` veya `getRequestLogger(...)`, request disinda `baseLogger`.
- Controller seviyesinde loglar orchestration odakli ve kisa olmali; hata loglama merkezi olarak `error-handler` uzerinden devam etmelidir.

## Workspace Config Types

- Workspace config tipi (`VnextWorkspaceConfig` ve alt tipleri) `@vnext-forge/vnext-types` paketinde kanonik olarak tanimlidir.
- `apps/server/src/slices/workspace/types.ts` bu tipleri `export type { ... } from '@vnext-forge/vnext-types'` ile re-export eder. Server-only tipler (`IWorkspace`, `WorkspaceAnalysisResult`, `SearchResult`, `DirectoryEntry` vb.) ayni dosyada kalir.
- Server icinde workspace config tiplerini kullanirken `@workspace/types.js` path alias'indan import et, dogrudan `@vnext-forge/vnext-types` yerine. Boylece server-only tipleri ve kanonik tipleri ayni noktadan alabilirsin.
- Workspace config tipi icin yeni local interface tanimlama; kanonik kaynaktan re-export edilen tipleri kullan.
