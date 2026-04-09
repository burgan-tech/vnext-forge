---
name: component-creation
description: Use when placing or designing UI in the web app during the architecture refactor. Components must move toward the repo's FSD structure and respect the layer import rules from `plans/new-architecture.md`.
---

# Component Creation Web

## Purpose

Use this skill to decide both what to build and where it belongs in the target web structure.

All new UI implementation in the web app must use Tailwind CSS utilities. Do not introduce or prefer plain CSS, SCSS, CSS modules, styled-components, or other component-local styling systems for new component work unless the task explicitly requires working within an existing non-Tailwind surface.

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
  api.ts        <- all apiClient calls for this entity, using callApi
  model/        <- store, types, mappers
  ui/           <- entity-specific components
  index.ts
```

`api.ts` functions return `Promise<ApiResponse<T>>` so they plug directly into `useAsync`.

### `features/*/`

Feature slices orchestrate entity services and `useAsync` for one user-action flow:

```
features/project-management/
  hooks/        <- useAsync-based hooks consuming entity services
  ui/           <- feature-specific components
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
- Do not create `index.ts` files just to re-export a single directly usable file. If the concrete file path is already clear and stable, import it from that file instead of adding an export barrel.
- In `shared/ui`, default hover behavior must follow interactivity ownership. Passive containers and static surfaces should default to `hoverable={false}`; clickable descendants may keep their own hover behavior.
- In `shared/ui`, clickable descendants must also be visually separable in their resting state. Do not rely on hover as the first or only affordance; use semantic surface, border, spacing, radius, and when appropriate subtle elevation so users can read the element as interactive before hovering it.
- Unless the task explicitly asks for a different visual language, prefer the primitive `default` variant. Treat `default` as the repo's baseline primary theme for most shared and composed UI.
- Treat `success` as the reusable positive-semantic family for clearly affirmative states, successful outcomes, and positive actions.
- Treat `muted` as the reusable passive-semantic family for empty states, no-data shells, non-clickable support regions, and other low-emphasis UI that should sit behind the mostly-`default` interface.
- Build new component styling with Tailwind utility classes.
- Move new work toward the target FSD tree even if nearby legacy code still lives elsewhere.
- During FSD migration, move callers to the new slice directly instead of leaving backward-compat wrapper or re-export bridge files in `routes/` or elsewhere. Keep old wrappers only if the task explicitly requires a staged migration boundary.
- Keep presentational primitives in `shared/ui`.
- Keep business-concept UI and API access in the owning `entities/*/`.
- Keep user-flow UI and `useAsync` hooks in the owning `features/*/`.
- Use `widgets` for composition, not for hidden business rules.
- If a `shared/ui` primitive already exposes `success` or `muted`, use that variant before reaching for custom Tailwind color overrides in `pages`, `widgets`, `features`, or `entities`.
- Keep semantic action styling tied to actual behavior. `create`, `add`, `confirm`, and other positive forward actions may use the repo's success-aligned family such as `tertiary` or `success` when that semantic distinction materially helps. `delete`, `remove`, `reset`, and other irreversible actions should use destructive semantics. `cancel`, `close`, `dismiss`, and `back` style actions should default to neutral, `default`, or `secondary` semantics unless the action itself deletes, resets, removes, or irreversibly changes user data.
- Empty states, no-data surfaces, no-project shells, and other intentionally non-clickable passive regions should read quieter than the mostly-`default` interactive UI. Prefer `muted`, `muted-foreground`, `border-subtle`, or the primitive's muted surface variant instead of letting passive states compete with `default` interactive controls.

## Do Not Do

- Do not add new reusable UI to legacy buckets such as `components`, `layout`, or route files when a target FSD destination is clear.
- Do not add `index.ts` barrel files when they exist only to mirror a single export file.
- Do not place feature logic inside `shared`.
- Do not make a widget own transport or domain rules.
- Do not place page-specific markup in a global component layer.
- Do not create cross-feature or cross-entity dependencies.
- Do not keep route-level or legacy wrapper files around for backward compatibility during FSD migration unless there is an explicit technical need.
- Do not call `apiClient` from widgets, pages, features, or hooks; that belongs in `entities/*/api.ts`.
- Do not add new component styling through plain CSS files, SCSS modules, CSS-in-JS, or inline style objects when Tailwind can express the UI.
- Do not add decorative hover to non-clickable `shared/ui` surfaces by default. Hover should usually communicate interaction.
- Do not make hover the only signal that an element is clickable.
- Do not style `cancel`, `close`, `dismiss`, or `back` actions with destructive variants unless the underlying action is genuinely destructive.
- Do not switch broad page or feature theming away from `default` without an explicit product or task reason.
- Do not style passive empty-state shells with the same visual weight as primary interactive controls.

## Decision Order

1. Check `shared/ui` first to see whether the component already exists.
2. If it exists in `shared/ui`, use it from there.
3. If it does not exist, decide whether the responsibility is shared, entity, feature, widget, page, or app.
4. Create the narrowest possible component in that layer.
5. Keep state and side effects out of lower presentation layers unless the layer truly owns them.
6. If the component needs data, wire it through the entity `api.ts` -> `useAsync` chain, not directly through `apiClient`.

## Shared UI Quick Map

- `button`: primary actions, inline actions, icon actions, submit/reset triggers
- `input`: short free-text, search, simple controlled text entry
- `textarea`: long-form text, notes, descriptions, multi-line editing
- `select`: constrained single selection from a known option list
- `checkbox`: boolean choice or multi-select option toggles
- `label`: field captions, helper labels, compact form semantics
- `field`: form row shell that groups label, control, hint, and validation text
- `section`: titled content grouping, collapsible content blocks, page subsections
- `card`: generic content surface for grouped information or actions
- `summary-card`: compact metric, status, or highlight summary surfaces
- `alert`: inline status, warning, info, or error messaging blocks
- `badge`: compact status, count, tag, or state indicators
- `accordion`: expandable content when multiple stacked disclosures are needed
- `dialog`: blocking confirmation, focused form flows, modal detail views
- `dropdown-menu`: compact action lists and contextual command menus
- `navigation-menu`: navigational action groups and menu-driven section switching
- `tabs`: peer views within the same context, not route-level navigation
- `tooltip`: short supplemental hints, not primary content delivery
- `separator`: low-emphasis visual separation between related regions
- `loading`: inline or section-level loading feedback and busy states
- `info-row`: labeled read-only values, metadata rows, copyable facts
- `json-code-field`: JSON/code preview or lightweight structured text editing
- `key-value-editor`: structured pair editing for maps, headers, params, metadata
- `tag-editor`: lightweight tag/chip creation and removal flows
- `sonner`: transient toast feedback for completed actions or async outcomes

Choose the narrowest `shared/ui` primitive that already matches the interaction before composing a new wrapper. If multiple primitives could work, prefer the one that preserves semantics and reduces custom state handling.

## Review Standard

Flag the implementation if:

- a new component extends the legacy folder structure without a migration reason
- a new `index.ts` exists only to forward a single file export with no real composition value
- `shared` code imports business concepts
- `features` depend on other `features`
- `entities` depend on other `entities`
- a page or widget owns logic that should live in a lower slice
- `apiClient` is called outside `entities/*/api.ts` or `features/*/api.ts`
- new UI is implemented without Tailwind despite no explicit constraint requiring an existing styling system
- interactive affordances only become discoverable on hover and are not visually separated from their parent surface at rest
- destructive styling is applied to routine dismissal actions such as `cancel` or `close` without destructive behavior
- broad UI defaults to non-`default` variants without an explicit semantic or product reason
- passive empty, no-data, or no-project regions visually compete with primary interactive surfaces instead of reading as muted support states
- FSD migration leaves wrapper, bridge, or compatibility re-export files in place without an explicit reason

## Component Creation Notes

- Framer Motion can be used for smooth, restrained animations when it improves clarity and perceived responsiveness.
- Prefer subtle transitions such as enter/exit fades, slight slide-ins, hover feedback, and layout transitions.
- Avoid decorative or excessive motion. Animations should support usability, not distract from the interface.
- Keep durations short and natural, and respect reduced-motion preferences when adding motion behavior.
