---
name: component-creation-web
description: Scope is apps/web (web frontend). Use when placing or designing UI in the web app during the architecture refactor. Components should follow the repo's simple module-based structure: default to module ownership, keep pages thin, and add extra structure only when reuse clearly justifies it. Trigger this skill for any component creation work under `apps/web`.
---

# Component Creation Web

> **Scope:** `apps/web` (web frontend). This skill applies only to code under `apps/web`.

## Purpose

Use this skill to decide both what to build and where it belongs in the target web structure.

All new UI implementation in the web app must use Tailwind CSS utilities. Do not introduce or prefer plain CSS, SCSS, CSS modules, styled-components, or other component-local styling systems for new component work unless the task explicitly requires working within an existing non-Tailwind surface.

## Default Placement

Place new UI in the narrowest owner that actually needs it:

- `shared`: generic, domain-agnostic UI primitives and helpers
- `modules`: user-facing behavior, UI, hooks, state, and service modules owned by one business area
- `pages`: route-level assembly and composition
- `app`: providers, router, and global setup

Keep the structure shallow:

- `pages` owns route entry files and route composition only
- `modules` owns the actual business screen content
- do not create `model`, `ui`, `hooks`, or `types` folders by reflex
- prefer shallow, colocated files inside the owning folder

## Default Module Shape

A module folder is usually enough:

```text
modules/project-list/
  project-list.view.tsx
  use-project-list.ts
  project-list.api.ts
  project-list.types.ts
```

Split into subfolders only after the module has become hard to navigate.

## Ownership Rules

- `pages/*` and `modules/*` may share the same business name, but their roles stay different.
- `pages/project-list/*` is the route boundary.
- `modules/project-list/*` is the business owner.
- Use page naming only in `pages/*`.
- Do not create a second page file inside `modules/*`. Use names like `*.view.tsx`, `*.panel.tsx`, or `*.section.tsx`.

## API Ownership

- Keep `apiClient`, `callApi`, and `unwrapApi` usage out of JSX.
- Put direct `apiClient` calls in the owning service module, usually module-local.
- Lift service code into `shared/*` only when the same logic is reused broadly and stays generic.
- `shared/api` stays transport-only; it does not own business workflows.

## Do

- Reuse an existing component before creating a new one.
- If a component is needed, check `shared/ui` first.
- If the component already exists in `shared/ui`, use that implementation instead of creating a duplicate elsewhere.
- Do not create `index.ts` files just to re-export a single directly usable file. If the concrete file path is already clear and stable, import it from that file instead of adding an export barrel.
- In `shared/ui`, default hover behavior must follow interactivity ownership. Passive containers and static surfaces should default to `hoverable={false}`; clickable descendants may keep their own hover behavior.
- In `shared/ui`, clickable descendants must also be visually separable in their resting state. Do not rely on hover as the first or only affordance; use semantic surface, border, spacing, radius, and when appropriate subtle elevation so users can read the element as interactive before hovering it.
- Unless the task explicitly asks for a different visual language, prefer the primitive `default` variant. Treat `default` as the repo's baseline primary theme for most shared and composed UI.
- Treat `success` as the reusable positive-semantic family for clearly affirmative states, successful outcomes, and positive actions.
- Treat `muted` as the reusable passive-semantic family for empty states, no-data shells, non-clickable support regions, and other low-emphasis UI that should sit behind the mostly-`default` interface.
- Build new component styling with Tailwind utility classes.
- Move new work toward the `app / pages / modules / shared` tree even if nearby legacy code still lives elsewhere.
- During migration, move callers to the new owner directly instead of leaving backward-compat wrapper or re-export bridge files in `routes/` or elsewhere. Keep old wrappers only if the task explicitly requires a staged migration boundary.
- Keep presentational primitives in `shared/ui`.

## Do Not Do

- Do not split one small module into `model`, `ui`, `hooks`, and `types` folders without a real navigation problem.
- Do not leave route-level glue files owning business logic that should live in a module.
- Do not place transport calls directly in page components or view components.

## Review Standard

Raise a concern when:

- a simple module was spread across extra folders or layers without a clear ownership benefit
- JSX calls transport helpers directly instead of delegating to an owning service module
- page files started accumulating module logic instead of composing owned modules
