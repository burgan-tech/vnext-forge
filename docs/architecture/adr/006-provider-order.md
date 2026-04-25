# ADR 006: Designer root provider order (R-f12 dropped)

**Status:** Accepted

## Context

R-f12 proposed a thin `getDesignerRootProviders(children)` helper to guarantee identical React provider ordering between shells.

## Decision

**R-f12 is DROPPED.** The codebase **does not** ship `getDesignerRootProviders`; provider trees remain **inlined** in each composition root so shell-specific wiring (notifications, routing, VS Code bridge) stays explicit.

## Documented order (current)

| Order | `apps/web` (`apps/web/src/main.tsx`) | `apps/extension` webview (`apps/extension/webview-ui/src/main.tsx`) |
|------|--------------------------------------|---------------------------------------------------------------------|
| 1 | `<StrictMode>` | `<StrictMode>` |
| 2 | `<DesignerUiProvider transport={...}>` | `<DesignerUiProvider transport={...}>` |
| 3 | `<SonnerNotificationProvider>` | *(none — VS Code native notifications)* |
| 4 | `<RouteErrorBoundary>` | *(none — router-less webview)* |
| 5 | `<AppRouter />` | `<HostEditorBridge />` |

**Webview-only bootstrap** (not React providers, but ordered): `setHostEditorCapabilities`, `registerNotificationSink`, `registerLogSink` run **before** `createRoot(...).render` — keep new side-effect registration consistent with existing sinks when adding global behavior.

## Rule for contributors

Any **new global React provider** that must exist in **both** shells should be added **in the same relative position** in **both** entry files above, and this ADR's table must be updated in the same PR.

## Consequences

- No extra indirection in `designer-ui` for ordering.
- Risk: future drift if contributors update only one entry — mitigated by this ADR + code review.

## Alternatives considered

- **R-f12 shared composer in `designer-ui`** — rejected for this repo state: shells differ materially (Sonner vs VS Code sinks, router vs bridge); a pure ordered composer would still need parameters and obscure differences.
