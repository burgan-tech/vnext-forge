# Web SPA vs VS Code extension — feature parity

This document records **current status**, **rationale**, and **planned trajectory** for capabilities that differ between the **web shell** (`apps/web`) and the **VS Code extension webview** (`apps/extension`). It complements the Core-4 audit items R-f7 (LSP capabilities), R-f15 (save ownership), R-f16 (notifications), and R-f9 (editor validation).

---

## Search

| | |
| --- | --- |
| **Status** | **Web-only** |
| **Implementation** | Project-scoped search lives under [`apps/web/src/modules/project-search/`](../../apps/web/src/modules/project-search/) — orchestration in [`useProjectSearch.ts`](../../apps/web/src/modules/project-search/useProjectSearch.ts), UI in [`SearchPanel.tsx`](../../apps/web/src/modules/project-search/SearchPanel.tsx) and [`SearchResultList.tsx`](../../apps/web/src/modules/project-search/SearchResultList.tsx). |
| **Rationale** | The extension host already provides workspace search; duplicating a second search stack in the webview would add maintenance cost without clear user benefit. The web SPA needs first-party search because it does not inherit VS Code’s global search. |
| **Trajectory** | Keep search as a **web shell concern**. If the webview later needs semantic “open file at match” flows, prefer **thin adapters** that delegate to the extension host’s search APIs rather than porting `SearchPanel` wholesale. |

---

## Save (keyboard + dirty state)

| | |
| --- | --- |
| **Status** | **Shared contract, host-specific wiring** |
| **Implementation** | Global save shortcut and dirty tracking follow the **single global owner** described in audit **R-f15** — designer-ui exposes hooks/registry; each shell registers one sink (web: browser shortcuts; extension: VS Code command bridge). |
| **Rationale** | Two independent save listeners caused duplicate saves and inconsistent dirty flags; one owner per shell keeps behavior predictable. |
| **Trajectory** | Continue to **centralize** save registration in designer-ui; shells only supply transport (HTTP vs extension message). Avoid reintroducing per-panel ad-hoc `Ctrl+S` handlers. |

---

## LSP (language services)

| | |
| --- | --- |
| **Status** | **Extension: full** / **Web: limited** |
| **Implementation** | Capability matrix is driven by **R-f7** `HostEditorCapabilities` — the extension advertises full C#/JSON-LSP integration; the web app advertises a reduced set (no workspace symbol bridge, etc.). Monaco setup and the Roslyn client live under `packages/designer-ui/src/modules/code-editor/`. |
| **Rationale** | The extension runs beside a real language host and file system; the web SPA is sandboxed and talks over HTTP/WebSocket with different security and lifecycle constraints. |
| **Trajectory** | **Narrow the gap** only where the backend can offer equivalent guarantees (e.g. diagnostics, completion). Do not promise VS Code–parity in the browser without matching server and auth story. |

---

## Notifications

| | |
| --- | --- |
| **Status** | **Shared port, single owner per shell (R-f16)** |
| **Implementation** | designer-ui defines a host-agnostic notification port; **web** uses Sonner (see `apps/web` notification provider); **extension** uses VS Code’s native notification APIs. Exactly **one** sink is registered per running shell. |
| **Rationale** | Multiple toast systems produced duplicate or lost messages; one owner per process keeps UX and testing tractable. |
| **Trajectory** | New surfaces should call the shared `showNotification` (or equivalent) API — **not** shell-specific toasts directly. |

---

## Validation (workflow + Monaco markers)

| | |
| --- | --- |
| **Status** | **Shared store + Monaco integration (R-f9)** |
| **Implementation** | `packages/designer-ui/src/store/useEditorValidationStore.ts` holds marker-derived **counts and issues** for the active Monaco document. `packages/designer-ui/src/editor/JsonCodeField.tsx` and the script panel subscribe via `monaco.editor.onDidChangeMarkers` (see `monacoMarkerSync.ts`). Workflow-level validation remains separate (`useValidationStore` / workflow-validation module) for graph and schema checks. |
| **Rationale** | Problems-style UI was unowned; wiring markers to a small Zustand slice gives a single place for badges and future “Problems” UI without forking Monaco per host. |
| **Trajectory** | **MVP**: badges / status hints only. **Later**: optional Problems panel, correlation with workflow validation, and extension parity if the webview embeds the same Monaco paths. |

---

## Cross-links

| Area | Web | Shared (designer-ui) |
| --- | --- | --- |
| Search | [`apps/web/src/modules/project-search/`](../../apps/web/src/modules/project-search/) | — |
| Editor JSON | — | [`JsonCodeField`](../../packages/designer-ui/src/editor/JsonCodeField.tsx), [`useEditorValidationStore`](../../packages/designer-ui/src/store/useEditorValidationStore.ts) |
| LSP / C# | — | `packages/designer-ui/src/modules/code-editor/` |
