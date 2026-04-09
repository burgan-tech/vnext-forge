---
name: architectural-pattern-web
description: Use when defining or refactoring web architecture in this repo without FSD. Prefer a common React module-based vertical slice structure with shallow ownership, a narrow `shared` layer, and explicit rules for local, module, server, and app-wide state.
---

# Architectural Pattern Web

## Purpose

Use this skill when deciding the target web architecture or reviewing whether a proposed structure is too layered, too global, or too FSD-shaped.

The default target is a common React architecture built around vertical slices and shared infrastructure:

- `app` for startup, providers, router, and truly global wiring
- `pages` for route entry and composition
- `modules` for business-owned vertical slices
- `shared` for generic cross-cutting building blocks

Simplicity is the main rule:

- default to one obvious owner
- keep folders shallow
- add structure only after a real navigation problem appears
- if two modules are tightly coupled all the time, they are probably one module

## Target Shape

```text
src/
  app/
    providers/
    router/
  pages/
    project-list/
      index.tsx
    workflow-editor/
      index.tsx
    settings/
      index.tsx
  modules/
    project-list/
      project-list.view.tsx
      project-list.api.ts
      use-project-list.ts
      project-list.store.ts
      project-list.types.ts
    workflow-editor/
      workflow-editor.view.tsx
      workflow-editor-toolbar.tsx
      workflow-editor.api.ts
      workflow-editor.store.ts
      use-workflow-editor.ts
  shared/
    api/
    ui/
    hooks/
    lib/
    config/
    types/
```

Start shallow. Add subfolders only after a module becomes hard to scan.

## Default Decision Order

When placing code, decide in this order:

1. If it is app startup, provider wiring, routing, or shell-level coordination, put it in `app`.
2. If it is route entry and composition, put it in `pages`.
3. If it belongs to one business area, put it in `modules`.
4. If it is truly generic and stable across modules, put it in `shared`.

If you are unsure, choose `modules`.

## Pages vs Modules

`pages` and `modules` may share the same business name such as `project-list`, but they do not play the same role.

- `pages/project-list/` is the route boundary
- `modules/project-list/` is the business module

This is allowed and expected. The important rule is that only `pages` owns page files.

Use this pattern:

```text
pages/
  project-list/
    index.tsx

modules/
  project-list/
    project-list.view.tsx
    use-project-list.ts
    project-list.api.ts
```

Meaning:

- `pages/project-list/index.tsx` is the route entry
- `modules/project-list/*` contains the actual business UI, state, and API logic

Do not create a second page component inside the module.

## Ownership Rules

- `app` may import `pages`, `modules`, and `shared`.
- `pages` may import `modules` and `shared`.
- `modules` may import `shared`.
- `shared` imports only other `shared` code and package-level dependencies.
- Do not shape code around FSD layer completion. Shape it around ownership and change boundaries.
- A module should not import another module by default. If coordination is needed, compose them from a page or move the stable contract into `shared`.

If one module keeps needing internals from another module, merge them or redefine the boundary. Do not patch a bad boundary with extra abstractions.

## Module Design

A module is the default owner for:

- UI that belongs to one business area
- module-local hooks
- module-local API/service files
- state used across multiple components in the same area
- module-specific types, mappers, and validation helpers

Prefer colocated files such as:

- `workflow-editor.api.ts`
- `workflow-editor.store.ts`
- `use-workflow-editor.ts`
- `workflow-editor.types.ts`

Naming rule:

- reserve `*.page.tsx` for `pages/*` only
- inside `modules/*`, prefer names such as `*.view.tsx`, `*.panel.tsx`, `*.section.tsx`, or a plain feature-specific file name

Do not split small modules into `model`, `ui`, `hooks`, `types`, or `services` folders by reflex.

## Module Growth Rule

Keep a module as flat files by default.

Split into one-level subfolders only when one of these is true:

- the module is hard to scan because it has grown past a small, readable file set
- there are two clearly different concerns inside the same module, such as `components` and `api`
- multiple developers regularly touch different areas of the same module

Even then, keep the split minimal:

```text
modules/workflow-editor/
  components/
  api/
  workflow-editor.store.ts
  use-workflow-editor.ts
```

Do not create deep trees inside a module unless the module is genuinely large.

## Public Surface

Each module should have one obvious entry point for outside consumers.

- outside callers should import the module's page/view/hook contract, not random internal files
- use `index.ts` only when it clarifies the module boundary
- do not build barrel files for every folder by default

## Shared Layer

`shared` exists, but it must stay intentionally small.

Put code in `shared` only when it is:

- generic and domain-agnostic
- stable across several modules
- unlikely to change because one module changes

Good fits:

- transport client and HTTP helpers in `shared/api`
- design-system primitives in `shared/ui`
- generic hooks in `shared/hooks`
- pure helpers in `shared/lib`
- app-wide config and constants in `shared/config`
- durable cross-module types in `shared/types`

Bad fits:

- business workflows
- module-specific API calls
- feature flags or state owned by one module
- helpers that exist only because two nearby files were not colocated

When shared code becomes shaped by one module's business rules, move it back out of `shared`.

## State Placement

Choose the narrowest owner that matches lifetime and reach.

## Local State

Keep in component state when it is:

- form input draft
- modal open state
- active tab
- hover, selection, and temporary UI flags
- one-view loading indicators

## Server State

Treat fetched backend data as server state, not global app state.

- Use a server-state tool such as TanStack Query for caching, invalidation, and request lifecycle.
- Keep query keys and request functions near the owning module.
- Do not mirror query results into a global store unless there is a real offline or editing reason.

## Module State

Use a module store or module hook when several components in the same area need shared client state.

Good fits:

- editor sidebar and canvas coordination
- filter state reused across a module section
- long-lived draft state inside one workflow area
- UI actions that several sibling components trigger

Prefer the lightest workable option:

- start with plain React state
- move to a custom hook when several components in the same module need the same logic
- use a module store when coordination becomes awkward with props or local hooks

If you choose a store library, keep it scoped to the owning module.

## App-Wide State

Use global app state only for concerns that truly cross distant routes or shell boundaries:

- auth or session
- active workspace or tenant reused across the shell
- theme and layout preferences
- notification center
- feature flags

If the state is mostly useful inside one route or module cluster, it is not app-wide state.

Default global-state stance:

- app-wide state should be rare
- global store files should stay few and boring
- do not use the global store as a cache for everything

## API Placement

- `shared/api` owns transport setup, interceptors, and generic request helpers.
- Each module owns its own API entry points such as `module-name.api.ts`.
- Keep request mapping, response normalization, and query integration near the module that uses them.
- Do not call transport helpers directly inside JSX.

## Routing

- Keep `pages` thin.
- A page should mostly compose one or more modules, pass route params, and define layout.
- Do not let pages become hidden business layers.
- The route entry can be `index.tsx` or `project-list.page.tsx`, but keep page naming inside `pages` only.

## Recommended Working Model

For most modules, this is enough:

- UI and small interaction state in the module
- server data via TanStack Query near the module
- route wiring in the page
- generic building blocks in `shared`
- only a few app-global stores for shell concerns

This model is intentionally boring. That is a strength.

## Do

- Prefer `modules` as the default business boundary.
- Start with colocated files and split only when navigation gets worse.
- Keep `shared` generic and small.
- Keep server state and client state separate in design discussions and code.
- Promote state upward only when multiple real consumers require it.
- Let pages compose modules instead of duplicating module logic.

## Do Not Do

- Do not reintroduce FSD layers under different names.
- Do not create `entities`, `features`, `widgets`, `model`, or `services` folders just to make the tree look architectural.
- Do not move module-specific code into `shared` for convenience.
- Do not create app-global stores for route-local async state.
- Do not mirror backend cache into a store without a concrete reason.
- Do not split one small module into many directories before there is a real scale problem.
- Do not add event buses, mediator layers, or orchestration abstractions unless the app has a demonstrated coordination problem that simpler composition cannot solve.

## Review Standard

Raise a concern when:

- a module was fragmented into several artificial layers without ownership gain
- `shared` contains business logic that clearly belongs to one module
- app-wide state was introduced for a page-local or module-local concern
- pages started owning workflows that should live inside modules
- server state and client state were mixed into one broad global store
- there are too many valid ways to do the same simple thing inside the same codebase
