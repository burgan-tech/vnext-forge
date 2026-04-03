---
name: component-creation
description: Use when placing or designing UI in the web app during the architecture refactor. Components must move toward the repo's FSD structure and respect the layer import rules from `plans/new-architecture.md`.
---

# Component Creation Web

## Purpose

Use this skill to decide both what to build and where it belongs in the target web structure.

## Target Layers

Place new UI in the narrowest FSD layer that fully owns it:

- `shared`: generic, domain-agnostic UI primitives and utilities
- `entities`: UI tied to one business concept
- `features`: UI tied to one user action or scenario
- `widgets`: page sections that compose entities and features
- `pages`: route-level assembly
- `app`: providers, router, global app setup

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
- Move new work toward the target FSD tree even if nearby legacy code still lives elsewhere.
- Keep presentational primitives in `shared/ui`.
- Keep business-concept UI in the owning `entities/*/ui`.
- Keep user-flow UI in the owning `features/*/ui`.
- Use `widgets` for composition, not for hidden business rules.

## Do Not Do

- Do not add new reusable UI to legacy buckets such as `components`, `layout`, or route files when a target FSD destination is clear.
- Do not place feature logic inside `shared`.
- Do not make a widget own transport or domain rules.
- Do not place page-specific markup in a global component layer.
- Do not create cross-feature or cross-entity dependencies.

## Decision Order

1. Check whether the UI already exists.
2. Decide whether the responsibility is shared, entity, feature, widget, page, or app.
3. Create the narrowest possible component in that layer.
4. Keep state and side effects out of lower presentation layers unless the layer truly owns them.

## Review Standard

Flag the implementation if:

- a new component extends the legacy folder structure without a migration reason
- `shared` code imports business concepts
- `features` depend on other `features`
- `entities` depend on other `entities`
- a page or widget owns logic that should live in a lower slice

## Component Creation Notes

- Framer Motion can be used for smooth, restrained animations when it improves clarity and perceived responsiveness.
- Prefer subtle transitions such as enter/exit fades, slight slide-ins, hover feedback, and layout transitions.
- Avoid decorative or excessive motion. Animations should support usability, not distract from the interface.
- Keep durations short and natural, and respect reduced-motion preferences when adding motion behavior.
