# packages/designer-ui - Context

> **Scope:** `packages/designer-ui` (shared React UI library used by `apps/web` and `apps/extension/webview-ui`). Load this file in addition to [`./CLAUDE.md`](./CLAUDE.md) when editing under `packages/designer-ui/`. **Skills:** [theme-color-system](./.cursor/skills/web/theme-color-system/SKILL.md), [icon-creation](./.cursor/skills/web/icon-creation/SKILL.md), [notification-container-pattern](./.cursor/skills/web/notification-container-pattern/SKILL.md), [error-taxonomy](./.cursor/skills/shared/error-taxonomy/SKILL.md), [dependency-policy](./.cursor/skills/shared/dependency-policy/SKILL.md). **Rule (Resizable / shell split):** [`.cursor/rules/designer-ui-resizable.mdc`](./.cursor/rules/designer-ui-resizable.mdc). Web/extension parity: [`docs/architecture/web-extension-parity.md`](./docs/architecture/web-extension-parity.md).

## Goal

Shared **primitives**, **canvas**, **editor**, and **LSP** plumbing with a **host-agnostic** surface: one library, multiple shells (web SPA, VS Code webview).

## Public surface

**Source of truth:** `packages/designer-ui/package.json` → **`exports`**. Consumers import only:

| Subpath | Role (summary) |
|---------|----------------|
| `@vnext-forge-studio/designer-ui` | Root barrel — default entry |
| `@vnext-forge-studio/designer-ui/editor` | Monaco-bearing editor components |
| `@vnext-forge-studio/designer-ui/ui` | Non-Monaco UI primitives |
| `@vnext-forge-studio/designer-ui/hooks` | Shared hooks barrel |
| `@vnext-forge-studio/designer-ui/lib` | Shared lib barrel |
| `@vnext-forge-studio/designer-ui/notification` | Notification port wiring |
| `@vnext-forge-studio/designer-ui/api` | Transport / API surface |
| `@vnext-forge-studio/designer-ui/styles.css` | Styles entry |

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

User-visible error copy must go through **`toErrorPresentation()`** (and related helpers) from **`@vnext-forge-studio/app-contracts`** — not raw `error.message`. Full contract: [`.cursor/skills/shared/error-taxonomy/SKILL.md`](./.cursor/skills/shared/error-taxonomy/SKILL.md), [ADR 005](./docs/architecture/adr/005-error-taxonomy.md).

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
| `@vnext-forge-studio/app-contracts`, `@vnext-forge-studio/vnext-types` | `apps/*` |
| Package-internal modules | **`@vnext-forge-studio/services-core`** — designer-ui stays **transport-agnostic**; do not import it here. See [dependency-policy](./.cursor/skills/shared/dependency-policy/SKILL.md). |

## Webview CSP note

Monaco requires **`'unsafe-eval'`** in the webview CSP. Risk and mitigations: [`docs/security/webview-csp.md`](./docs/security/webview-csp.md).

## Schema editor (`modules/schema-editor/`)

The Schema component editor was rewritten across phases 1–6 of [`docs/superpowers/specs`](./docs/superpowers/specs). The legacy `components/SchemaTree.tsx` (1111 lines) is gone — the new module is decomposed under `components/tree-editor/` and the surrounding model / hooks layers.

```text
modules/schema-editor/
  components/
    SchemaEditorPanel.tsx           # Hosts metadata + Visual/Source toggle + ValidatePayloadCard
    SchemaMetadataForm.tsx, ValidatePayloadCard.tsx  # untouched legacy pieces
    tree-editor/
      SchemaTreeEditor.tsx          # two-pane root (left tree + right detail panel)
      RootCompositionPanel.tsx      # collapsible root allOf/anyOf/oneOf/not shortcut
      property-tree/                # left pane (tree, header, DnD hook, node)
      detail-panel/
        DetailPanel.tsx             # tab host
        DetailPanelHeader.tsx       # breadcrumb (push-to-pane selection)
        tabs/                       # General | Constraints | Composition | vNext
      constraints/                  # String/Number/Array/Object constraint editors
      composition/                  # CompositionList, NotCompositionEditor, SubschemaCard
      vnext/                        # 9 x-* cards + shared VNextCardShell / FilterListEditor
      raw/                          # RawPassthroughBadge + RawJsonFallback (Monaco passthrough)
  hooks/                            # useSchemaSelection, useSchemaNode, useVNextEnabled
  model/                            # jsonPointer, schemaNode, mutators, breadcrumb, recognizedKeywords
  useSchemaEditorStore.ts           # Zustand store; canonical = full componentJson
  SchemaEditorSchema.ts             # Zod loader (permissive on load, strict via AJV on save)
```

**Canonical form:** the store holds the full `componentJson` (`Record<string, unknown>`); typed accessors live in `model/schemaNode.ts`. Mutators in `model/mutators.ts` are Immer recipes targeted by RFC 6901 JSON Pointers. Unknown keywords always passthrough — `model/recognizedKeywords.ts` + `RawJsonFallback` make that explicit in the UI.

**Selection model:** `useSchemaSelection` is a separate Zustand slice (one JSON Pointer string). `useResolvedSelection` falls back to the nearest ancestor if the pointer drifts after a mutation; selection is never persisted.

**vNext (`x-*`) cards** share `VNextCardShell` (header + enable toggle + body + error footer) and are listed in `vnext/vnextCardRegistry.ts`. Adding a new `x-*` field means writing one `X*Card.tsx`, registering it, and (if the keyword is not yet in `model/recognizedKeywords.ts`) extending the allow-list so it stops appearing in the passthrough badge.

## pseudo-ui Shadow-DOM Theming

The `quick-run/pseudo-ui` surface mounts `@burgantech/pseudo-ui/react`'s
`<PseudoView>` **inside a shadow root** so the developer's view design
shows as designed, without parent Tailwind preflight, designer-ui
unlayered resets, or VS Code's injected `input/textarea/select`
`!important` styles bleeding through. Forge is a *designer* — it does
not impose its own chrome on the canvas. The only Forge-side hook into
the canvas is the user-supplied tenant CSS (`pseudoUiTenantTokens`
setting).

**Layered cascade inside the shadow root** (built by
`theme/buildSheets.ts → syncThemeLayers`):

| Layer | Source | Notes |
|---|---|---|
| L1 — Base MDC theme | `primereact/resources/themes/mdc-{light,dark}-indigo/theme.css?raw` | `:root` rewritten to `:host, :root` so design tokens bind inside the shadow tree |
| L0 — Utilities | inline string | `.p-hidden-accessible` (hides Dropdown / Calendar native peers) + `.p-stepper-number { border-radius: 50% }` |
| L2 — Forge defaults | `theme/forgeDefaults.ts` | M3 indigo `--p-*` tokens for light + dark |
| L3 — Tenant override | `theme/parseTenantCss.ts` (validated) | Token-only contract; class selectors and non-`--*` properties rejected |
| Icons | `primeicons`, `material-icons` `?raw` | Class rules in shadow; `@font-face` loaded via parent-doc side-effect imports (CSS scoping spec: shadow trees inherit `@font-face` from outer doc) |
| L4 — SDK CSS | `pseudo-ui-react.css` | Adopted automatically by `<PseudoView renderRoot={shadow} />` |

Layers are constructable `CSSStyleSheet` instances cached at module
level and applied atomically via
`shadow.adoptedStyleSheets = [...]` — no inter-frame flicker on theme
or tenant change. `appTheme` mirrors `html.dark` on the parent `<html>`
element (the existing `colorTheme: 'system'` setting drives that
class).

### The non-negotiable invariant

**`primeReactConfig.styleContainer = shadow` MUST stay set in
`PseudoUiPseudoViewFrame.tsx`.** PrimeReact 10 splits CSS into:

- **Static theme** (MDC / Lara `theme.css`) — *visual decoration* only.
- **Runtime structural CSS** — each component (Stepper, Dropdown,
  Calendar, …) carries a `styles` string bundled in its JS that
  PrimeReact's `useStyle` hook injects into
  `context.styleContainer || document.head` on mount. This is where
  `display: flex`, `flex: 1 1 0` on separators, `position: relative`
  on icon containers, etc. live. **Without it, layout silently
  degrades** — Stepper indicators render as rounded squares without
  connecting separators, Dropdown native `<select>` peers leak as
  ghost form controls, popovers position incorrectly.

The bug is silent (no console error) and trivial to introduce by
"cleaning up" the prop. Treat the `styleContainer` line as
load-bearing.

We do **not** set `theme.preset` — design tokens come from the static
MDC theme + Forge defaults. The runtime preset would emit token CSS
targeted at `:root` which matches nothing in a shadow tree (CSS
scoping spec), leaving components fully un-styled even though the
runtime structural CSS is present.

### Tenant CSS contract

Tenants override only CSS custom properties (`--p-*`, `--font-family`).
SDK internal class names (`.d-card`, `.field-group-label`, …) are
**not** part of the public API and may change in any minor SDK
release. The validator in `theme/parseTenantCss.ts` silently drops
class selectors, non-custom properties, and values containing `;`,
`{`, or `}` (CSS-injection guard).

Two input shapes accepted: token JSON (preferred,
`{ '--p-primary-color': '#FF6B35', ... }`) and CSS string (parsed via
regex AST, only `:host { --*: value }` declarations survive).

Detailed rule + checklist in
[`.cursor/rules/pseudo-ui-shadow-theming.mdc`](./.cursor/rules/pseudo-ui-shadow-theming.mdc).
Original spec at `forgepseudouithemingspec.md`.

## Adding a new component

1. Pick folder: **`editor/`** (Monaco) vs **`ui/`** vs **`modules/*`**.
2. Add to a **public barrel** (`exports` or root re-export) **only** if external apps need the symbol.
3. Styling/tokens → [theme-color-system](./.cursor/skills/web/theme-color-system/SKILL.md).
4. New file-tree / component-type icons → [icon-creation](./.cursor/skills/web/icon-creation/SKILL.md).
5. New package subpath → [bundler checklist](./docs/architecture/bundler-checklist.md).
6. New pseudo-ui mount surface (rare) → [pseudo-ui-shadow-theming rule](./.cursor/rules/pseudo-ui-shadow-theming.mdc) — copy `PseudoUiPseudoViewFrame` setup verbatim; the `styleContainer` wiring is load-bearing.

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
