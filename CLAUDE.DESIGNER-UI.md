# packages/designer-ui - Context

> **Scope:** `packages/designer-ui` (shared React UI library used by `apps/web` and `apps/extension/webview-ui`). Load this file in addition to [`./CLAUDE.md`](./CLAUDE.md) when editing under `packages/designer-ui/`. **Skills:** [theme-color-system](./.cursor/skills/web/theme-color-system/SKILL.md), [icon-creation](./.cursor/skills/web/icon-creation/SKILL.md), [notification-container-pattern](./.cursor/skills/web/notification-container-pattern/SKILL.md), [error-taxonomy](./.cursor/skills/shared/error-taxonomy/SKILL.md), [dependency-policy](./.cursor/skills/shared/dependency-policy/SKILL.md). **Rule (Resizable / shell split):** [`.cursor/rules/designer-ui-resizable.mdc`](./.cursor/rules/designer-ui-resizable.mdc). Web/extension parity: [`docs/architecture/web-extension-parity.md`](./docs/architecture/web-extension-parity.md).

## Goal

Shared **primitives**, **canvas**, **editor**, and **LSP** plumbing with a **host-agnostic** surface: one library, multiple shells (web SPA, VS Code webview).

## Public surface

**Source of truth:** `packages/designer-ui/package.json` → **`exports`**. Consumers import only:

| Subpath | Role (summary) |
|---------|----------------|
| `@vnext-forge/designer-ui` | Root barrel — default entry |
| `@vnext-forge/designer-ui/editor` | Monaco-bearing editor components |
| `@vnext-forge/designer-ui/ui` | Non-Monaco UI primitives |
| `@vnext-forge/designer-ui/hooks` | Shared hooks barrel |
| `@vnext-forge/designer-ui/lib` | Shared lib barrel |
| `@vnext-forge/designer-ui/notification` | Notification port wiring |
| `@vnext-forge/designer-ui/api` | Transport / API surface |
| `@vnext-forge/designer-ui/styles.css` | Styles entry |

**Rules**

- **Never** deep-import `dist/**` or `src/**` from outside the package.
- Internal folders such as `src/modules/code-editor/` and `src/modules/flow-editor/` are **organizational barrels**; outside apps use only **`exports`** entries above (or the root), not filesystem paths under `modules/`.
- Adding a new consumer-facing subpath → follow [`docs/architecture/bundler-checklist.md`](./docs/architecture/bundler-checklist.md).

## Folder layout

```text
packages/designer-ui/src/
  editor/                 # Monaco subpath (R-f14; migrated from ui/)
  lsp/
  lib/
  hooks/
  store/
  modules/
    code-editor/
    flow-editor/
    canvas-interaction/
  ui/
```

## Host capabilities (R-f7 / R-f20)

| Piece | Location / role |
|-------|------------------|
| `lsp/HostEditorCapabilities.ts` | Host capability **interface** (open doc, reveal, etc.). |
| `lsp/hostEditorCapabilitiesRegistry.ts` | **Single registration point** in designer-ui (`setHostEditorCapabilities` / reads). |
| `webHostEditorCapabilities` | **No-op** adapter in **`apps/web/src/shared/host/webHostEditorCapabilities.ts`**. |
| `extensionHostEditorCapabilities` | **VS Code** adapter in **`apps/extension/webview-ui/src/host/extensionHostEditorCapabilities.ts`**. |

**Rule:** each shell registers **exactly one** adapter on startup. Designer-ui reads from the **registry** — never assume a specific host.

## Global save shortcut (R-f15)

| Piece | Responsibility |
|-------|----------------|
| `lib/globalSaveShortcutRegistry.ts` | Owns the **single** `Ctrl+S` / `Meta+S` subscription. |
| `hooks/useRegisterGlobalSaveShortcut.ts` | Shell hook to register the active save handler. |

**Rule:** `useSaveFile`, `useSaveComponent`, `useSchemaEditor`, `useFlowEditorPersistence`, and similar hooks **must not** attach their own `keydown` listeners.

## Notification port (R-f16)

Designer-ui exposes a **host-agnostic** notification port. **Web** registers **Sonner**; **extension** registers **VS Code** native notifications. `useAsync` defaults remain overridable per callsite.

## Editor validation store (R-f9)

| Piece | Responsibility |
|-------|----------------|
| `store/useEditorValidationStore.ts` | Monaco **marker counts** (errors/warnings). |
| `editor/monacoMarkerSync.ts` | Subscribes via `monaco.editor.onDidChangeMarkers`. |
| `JsonCodeField`, script editor panel | **Slim** status strip from validation store. |

**Workflow graph validation** stays in **`apps/web/src/modules/workflow-validation/`** — separate from Monaco markers.

## postMessage origin policy

| Piece | Rule |
|-------|------|
| `lib/messageOriginPolicy.ts` | Exports `isMessageOriginAllowed`. |
| `VsCodeTransport`, `HostEditorBridge` | **Must** validate `MessageEvent.origin` against **`window.__VNEXT_CONFIG__.POST_MESSAGE_ALLOWED_ORIGINS`**. |

Do **not** bypass origin checks.

## useAsync defaults

See [`docs/architecture/useAsync-callsite-inventory.md`](./docs/architecture/useAsync-callsite-inventory.md). **Editor saves** — avoid auto-toast on error; **passive queries** — avoid auto-toast; **workspace mutations** — may toast via explicit `onError` / shared notification policy.

## Error presentation

User-visible error copy must go through **`toErrorPresentation()`** (and related helpers) from **`@vnext-forge/app-contracts`** — not raw `error.message`. Full contract: [`.cursor/skills/shared/error-taxonomy/SKILL.md`](./.cursor/skills/shared/error-taxonomy/SKILL.md), [ADR 005](./docs/architecture/adr/005-error-taxonomy.md).

## Internationalization

All designer-ui **user-visible strings** are **English-only**; product-wide rule in [`./CLAUDE.md`](./CLAUDE.md) (section **User-visible language**).

## Resizable (`src/ui/Resizable.tsx`)

shadcn-style wrapper over **`react-resizable-panels` v4** (`Group` / `Panel` / `Separator`). Compact invariants:

- **No `withHandle`**: no built-in fat grip/icon — thin affordance only.
- **Narrow at rest** (~1px line via `::before`), subtle hover; wide hit target, quiet chrome.
- **`ResizablePanelGroup` default `disableCursor: true`**: no `ew-resize`/`ns-resize` on hover; cursor changes only while actually dragging (library behavior).
- **Handle flush to the controlled edge** (e.g. vertical split: line on the sidebar-adjacent side of the handle column) so the bar doesn’t float mid-gutter.
- **`ResizablePanel` extensions**: `autoCollapseBelowMin` (→ `collapsible` + `collapsedSize` 0) and optional **`collapseOvershootPx`** with **pixel** `minSize` (library threshold = `minSize − overshoot`).

Deeper split-pane UX: [theme-color-system — Split pane](./.cursor/skills/web/theme-color-system/SKILL.md#split-pane-and-resizable-panel-patterns).

## Dependency boundaries

| Allowed | Forbidden |
|---------|-----------|
| `@vnext-forge/app-contracts`, `@vnext-forge/vnext-types` | `apps/*` |
| Package-internal modules | **`@vnext-forge/services-core`** — designer-ui stays **transport-agnostic**; do not import it here. See [dependency-policy](./.cursor/skills/shared/dependency-policy/SKILL.md). |

## Webview CSP note

Monaco requires **`'unsafe-eval'`** in the webview CSP. Risk and mitigations: [`docs/security/webview-csp.md`](./docs/security/webview-csp.md).

## Adding a new component

1. Pick folder: **`editor/`** (Monaco) vs **`ui/`** vs **`modules/*`**.
2. Add to a **public barrel** (`exports` or root re-export) **only** if external apps need the symbol.
3. Styling/tokens → [theme-color-system](./.cursor/skills/web/theme-color-system/SKILL.md).
4. New file-tree / component-type icons → [icon-creation](./.cursor/skills/web/icon-creation/SKILL.md).
5. New package subpath → [bundler checklist](./docs/architecture/bundler-checklist.md).

## Cross-references

- [ADR 001](./docs/architecture/adr/001-trust-model.md) — trust model  
- [ADR 002](./docs/architecture/adr/002-trace-headers.md) — trace headers  
- [ADR 004](./docs/architecture/adr/004-bootstrap-aggregation.md) — bootstrap RPC  
- [ADR 005](./docs/architecture/adr/005-error-taxonomy.md) — errors  
- [ADR 006](./docs/architecture/adr/006-provider-order.md) — provider order  
- [Dependency policy](./docs/architecture/dependency-policy.md)  
- [Web / extension parity](./docs/architecture/web-extension-parity.md)  
- [Trace headers skill](./.cursor/skills/shared/trace-headers/SKILL.md)  

## Expectation

Ship **small, composable** surfaces: one registry for host capabilities, one global save owner, one notification port per shell, and **exports-only** consumption from apps.
