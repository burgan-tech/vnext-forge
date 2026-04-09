# Web Modules x Skills Checklist

Bu doküman `apps/web/src/modules` altındaki hedef owner modülleri web skill'leri üzerinden aynı rubric ile denetlemek için kullanılır. Amaç serbest not üretmek değil; her modül için aynı sorularla hızlı uygunluk değerlendirmesi yapmak ve sonraki refactor sırasını netleştirmektir.

Bu ilk sürüm yalnızca hedef owner modülleri kapsar. `legacy-*` alanları ana matrise dahil edilmez; önce eritilmesi gereken geçiş alanları olarak ele alınır.

## Legacy Cleanup First

- `legacy-routes` -> ilgili `pages/*` owner'larına taşınmalı. Route entry ve route composition page altında kalmalı; business ownership module'a dönmeli.
- `legacy-hooks` -> ilgili `modules/*` owner'larına eritilmeli. Hook bir modül davranışıysa aynı owner altında yaşamalı.
- `legacy-stores` -> owning module state dosyalarına taşınmalı. Bağımsız store klasörü kalmamalı.
- `legacy-entities` -> `project-*`, `workflow-*`, `editor-*` owner'larına veya gerçekten generic ise `shared/*`e daraltılmalı.

## Status Legend

- `U` = Uygun
- `K` = Kısmen
- `D` = Uygun Değil
- `N` = N/A

## Audit Rubric

### Architectural Pattern

- Modül owner sınırı net mi?
- `pages / modules / shared` sınırı doğru mu?
- Legacy yatay soyutlama veya geçiş kalıntısı var mı?

### API Fetching

- Request code owning service içinde mi?
- UI veya page transport owner olmuş mu?
- `shared/api/client.ts -> module service -> UI` akışı korunuyor mu?

### API Error Handling

- Hata kontratı `VnextForgeError` akışına uyuyor mu?
- Raw error veya message parsing var mı?
- UI yalnızca normalize edilmiş mesaj mı görüyor?

### State Store Handling

- State en dar owner'da mı?
- Global veya legacy store gereksiz kullanılmış mı?
- Server state ile UI state karışmış mı?

### Async Feature Flow

- `useAsync` veya eşdeğer async lifecycle doğru owner'da mı?
- Async orchestration module sınırında mı?
- Ad hoc loading/error akışları çoğalmış mı?

### Validation Zod

- Form validation doğru owner'da mı?
- Durable contract schema tekrar üretilmiş mi?
- Runtime trust validation yanlış katmana sızmış mı?

### Notification Feedback

- Notification kararı service yerine orchestration katmanında mı?
- Ephemeral feedback gereksiz global state'e taşınmış mı?
- Shared notification pattern bypass edilmiş mi?

### Theme Color System

- Generic primitive contract korunuyor mu?
- Modül raw stil kararlarıyla token veya variant yapısını bypass ediyor mu?
- Theme konusu modül için relevant değilse `N` kullanılmalı.

## Modules x Skills Matrix

| Module | Architecture | API Fetching | API Errors | State | Async | Validation | Notification | Theme |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `canvas-interaction` | K | N | N | K | K | N | N | N |
| `code-editor` | K | K | K | K | K | K | N | N |
| `extension-editor` | K | N | N | K | K | K | N | N |
| `function-editor` | K | N | N | K | K | K | N | N |
| `project-management` | D | K | K | D | K | K | N | N |
| `project-workspace` | D | K | K | K | K | N | N | N |
| `save-component` | K | N | N | K | K | K | N | N |
| `save-workflow` | K | N | N | K | K | N | N | N |
| `schema-editor` | K | N | N | K | K | K | N | N |
| `task-editor` | K | N | N | K | K | K | N | N |
| `view-editor` | K | N | N | K | K | K | N | N |
| `workflow-execution` | K | K | K | K | K | N | N | N |
| `workflow-validation` | U | N | K | U | K | U | N | N |

## Per-Module Action Notes

### `canvas-interaction`

- Main gaps: deep internal tree still looks like migrated horizontal slices; store placement needs owner check; async canvas actions are not yet expressed through a clear public module contract.
- Priority fixes: define public entry files, colocate canvas actions around the owning flows, review whether `workflow-store.ts` is too broad for this owner.
- Dependencies / blockers: may depend on cleanup of `legacy-stores` if any older workflow editing state still points there.

### `code-editor`

- Main gaps: module still carries editor infra, store, save-file behavior and script-panel state in one broad owner; API and error boundaries need a clearer service boundary; validation-related concerns may still bleed into editor files.
- Priority fixes: isolate editor-facing service entry points, keep Monaco and file-save orchestration behind a narrow module API, review whether validation hooks belong here or in `workflow-validation`.
- Dependencies / blockers: legacy route and hook cleanup can still affect editor entry ownership.

### `extension-editor`

- Main gaps: page-like and panel-like structures still live inside the module; state ownership is not yet obviously minimal; validation ownership should stay with form-level logic only.
- Priority fixes: define a thin public module surface, keep form state local, and remove any page-shaped responsibilities that belong in `pages/extension-editor`.
- Dependencies / blockers: migration of `legacy-routes` to proper pages may still be required.

### `function-editor`

- Main gaps: module shape still looks partly route-driven; state and async form behavior need a more explicit owner boundary; validation should be colocated with the function editing forms only.
- Priority fixes: keep the module focused on function editing behavior, expose scenario-named actions, and move page composition concerns to `pages/function-editor`.
- Dependencies / blockers: legacy route cleanup is the main blocker if old page imports still exist.

### `project-management`

- Main gaps: internal `features/*` structure and `project-store-legacy.ts` show unresolved FSD carry-over; project state ownership is broader than the target pattern; API ownership exists but still sits next to legacy structure.
- Priority fixes: flatten the owner around one module API, remove `features/*` and legacy store remnants, keep create/import/delete/list flows under one shallow business owner.
- Dependencies / blockers: `legacy-entities` and `legacy-stores` cleanup may still feed project state and project API helpers.

### `project-workspace`

- Main gaps: `widgets/*` carry-over and mixed file-tree/sidebar/workspace concerns indicate unresolved migration; API and file-routing behavior need a cleaner service boundary; owner is broader than necessary.
- Priority fixes: flatten file-tree and sidebar orchestration into one shallow owner, keep workspace endpoint access in module services, and move generic rendering pieces only if they are truly reusable.
- Dependencies / blockers: `legacy-entities` cleanup may still affect workspace API and file routing ownership.

### `save-component`

- Main gaps: internal `components/*` tree suggests horizontal carry-over; save behavior and local component state should be easier to audit from one public entry; validation coupling is unclear.
- Priority fixes: reduce the owner to save-component actions, state and form-level UI, then expose one narrow module API to consuming pages or modules.
- Dependencies / blockers: cleanup of legacy hooks or stores may still be needed if save behavior is shared indirectly.

### `save-workflow`

- Main gaps: module is currently very thin and may hide ownership in external hooks or stores; public contract is not yet obvious; async lifecycle should be explicit if reused.
- Priority fixes: clarify whether this is a standalone owner or a sub-flow of workflow editing, then colocate save behavior, error handling and any request orchestration together.
- Dependencies / blockers: may depend on `canvas-interaction`, `workflow-execution` or legacy hook cleanup depending on current save call sites.

### `schema-editor`

- Main gaps: module still appears partly page-shaped; local form and tree concerns may need a clearer public module surface; validation ownership should stay local and not drift into generic helpers.
- Priority fixes: keep schema editing behavior shallow, expose page-consumable entry points, and ensure form validation is colocated with editing flows.
- Dependencies / blockers: old route migration may still be needed to finish page vs module separation.

### `task-editor`

- Main gaps: forms and panel structures are present but owner boundaries may still be broader than necessary; async and validation flows should remain module-local; page responsibility may still leak in.
- Priority fixes: narrow the module around task editing actions and forms, move route composition out, and keep validation logic close to the task form surface.
- Dependencies / blockers: legacy route cleanup is the likely prerequisite for a fully clean owner boundary.

### `view-editor`

- Main gaps: `view-builder` naming shows migration residue; module still looks like a repackaged old owner; state and validation flows need a more explicit public contract.
- Priority fixes: rename and flatten around the actual owner, keep page responsibilities in `pages/view-editor`, and colocate only view-editing behavior here.
- Dependencies / blockers: `legacy-routes` and possible old builder-specific imports may still need cleanup.

### `workflow-execution`

- Main gaps: current owner looks state-heavy and thin on explicit execution service boundaries; API and error handling responsibilities should be easier to locate; public execution flows are not yet obvious from the module shape.
- Priority fixes: define explicit execution actions and service entry points, keep runtime state scoped to execution flows, and avoid letting execution concerns spread into pages or unrelated modules.
- Dependencies / blockers: may depend on broader runtime proxy integration and any leftover legacy store ownership.

### `workflow-validation`

- Main gaps: module ownership is relatively clear, but error normalization and async boundary decisions should still be reviewed; validation UX and engine boundaries can drift if editor concerns leak in.
- Priority fixes: keep validation engine, panel and store under one owner, ensure async validation flows use one consistent pattern, and keep UI on normalized messages only.
- Dependencies / blockers: editor-side diagnostics integration may still create cross-owner pressure with `code-editor`.

## Cross-Cutting Findings

- `project-management` and `project-workspace` are the highest-priority refactor targets. Both still expose obvious FSD carry-over through `features/*`, `widgets/*`, and legacy store patterns.
- Several editor-oriented modules still contain page-shaped files inside module ownership. `pages/*` vs `modules/*` separation should be rechecked for `extension-editor`, `function-editor`, `schema-editor`, `task-editor`, and `view-editor`.
- `notification-feedback-web` and `theme-color-system-web` are currently not dominant compliance axes for most modules. `N` should remain valid until those concerns are intentionally introduced.
- `workflow-validation` is the cleanest current owner in the module set. It can be used as a reference slice when tightening other modules.
- The next audit pass should verify actual imports and call sites per module, then upgrade this checklist from structural first-pass to evidence-backed status updates.
