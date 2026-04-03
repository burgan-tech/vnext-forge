# apps/web - Context

`apps/web` is the web client of vnext-forge. The standalone product framing belongs to the monorepo/product as a whole, not to `apps/web` as an isolated application.

## Goal

Build and evolve the web app as the primary workflow authoring interface. In the first phase, its main role is workflow design and code editing: project/workspace management, visual flow editing, component/code editors, and validation-oriented UX. It should not be framed as the place that boots or runs the external runtime.

## Direction

The current web app will be modularized under the new architecture. Move toward clear boundaries, thinner composition layers, reusable domain packages, and isolated UI responsibilities. Prefer extracting durable logic into shared packages or well-bounded modules instead of expanding page-level or route-level coupling.

## Expectation

When working in `apps/web`, optimize for a maintainable product-facing web client: strong UX, explicit boundaries, predictable state, package-first reuse, and architecture-safe incremental migration.

## Rules

Detailed implementation rules, slice constraints, and architecture-specific conventions should be referenced from dedicated rule documents once finalized.
