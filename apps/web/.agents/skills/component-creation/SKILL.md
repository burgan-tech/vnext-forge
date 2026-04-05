---
name: component-creation
description: Use when placing or designing UI in the web app during the architecture refactor. Components must move toward the repo's FSD structure and respect the layer import rules from `plans/new-architecture.md`.
---

# Component Creation Web

## Purpose

Use this skill to decide both what to build and where it belongs in the target web structure.

## Target Layers

Place new UI in the narrowest FSD layer that fully owns it:

- `shared`: generic, domain-agnostic UI primitives, utilities, and transport helpers
- `entities`: UI and data access tied to one business concept
- `features`: UI tied to one user action or scenario
- `widgets`: page sections that compose entities and features
- `pages`: route-level assembly
- `app`: providers, router, global app setup

## Layer Responsibilities

### `entities/*/`

Each entity slice owns both its UI and its data access:

```
entities/project/
  api.ts        ← all apiClient calls for this entity, using callApi
  model/        ← store, types, mappers
  ui/           ← entity-specific components
  index.ts
```

`api.ts` functions return `Promise<ApiResponse<T>>` so they plug directly into `useAsync`.

### `features/*/`

Feature slices orchestrate entity services and `useAsync` for one user-action flow:

```
features/project-management/
  hooks/        ← useAsync-based hooks consuming entity services
  ui/           ← feature-specific components
  index.ts
```

### `shared/api/`

Transport-only: `apiClient`, `callApi`, `unwrapApi`. No business logic here.

## Import Rules

- Import only downward.
- `pages` may use `widgets`, `features`, `entities`, and `shared`.
- `widgets` may use `features`, `entities`, and `shared`.
- `features` may use `entities` and `shared`.
- `entities` may use `shared`.
- `features` do not import other `features`.
- `entities` do not import other `entities`.

## Do

- Reuse an existing component before creating a new one.
- If a component is needed, check `shared/ui` first.
- If the component already exists in `shared/ui`, use that implementation instead of creating a duplicate elsewhere.
- Move new work toward the target FSD tree even if nearby legacy code still lives elsewhere.
- Keep presentational primitives in `shared/ui`.
- Keep business-concept UI and API access in the owning `entities/*/`.
- Keep user-flow UI and `useAsync` hooks in the owning `features/*/`.
- Use `widgets` for composition, not for hidden business rules.

## Do Not Do

- Do not add new reusable UI to legacy buckets such as `components`, `layout`, or route files when a target FSD destination is clear.
- Do not place feature logic inside `shared`.
- Do not make a widget own transport or domain rules.
- Do not place page-specific markup in a global component layer.
- Do not create cross-feature or cross-entity dependencies.
- Do not call `apiClient` from widgets, pages, features, or hooks — that belongs in `entities/*/api.ts`.

## Decision Order

1. Check `shared/ui` first to see whether the component already exists.
2. If it exists in `shared/ui`, use it from there.
3. If it does not exist, decide whether the responsibility is shared, entity, feature, widget, page, or app.
4. Create the narrowest possible component in that layer.
5. Keep state and side effects out of lower presentation layers unless the layer truly owns them.
6. If the component needs data, wire it through the entity `api.ts` → `useAsync` chain — not directly through `apiClient`.

## Review Standard

Flag the implementation if:

- a new component extends the legacy folder structure without a migration reason
- `shared` code imports business concepts
- `features` depend on other `features`
- `entities` depend on other `entities`
- a page or widget owns logic that should live in a lower slice
- `apiClient` is called outside `entities/*/api.ts` or `features/*/api.ts`

## Component Creation Notes

- Framer Motion can be used for smooth, restrained animations when it improves clarity and perceived responsiveness.
- Prefer subtle transitions such as enter/exit fades, slight slide-ins, hover feedback, and layout transitions.
- Avoid decorative or excessive motion. Animations should support usability, not distract from the interface.
- Keep durations short and natural, and respect reduced-motion preferences when adding motion behavior.
