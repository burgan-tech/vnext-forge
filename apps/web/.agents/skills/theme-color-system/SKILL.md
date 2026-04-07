---
name: theme-color-system-web
description: Optional guidance for theming and color tokens in the web app. Use only when the task is explicitly about visual system work; do not treat theme token migration as a required part of the architecture refactor.
---

# Theme Color System Web

## Purpose

Use this skill when a task is explicitly about visual system cleanup, theming, or tokenization.

This skill is optional. It is not a blocking rule for the structural architecture refactor.

When theme work is in scope for the web app, apply it through Tailwind-based styling. Tailwind is the required styling path for new visual system work unless the task is explicitly constrained by an existing non-Tailwind surface.
All reusable color decisions must come from the shared token source in `apps/web/src/index.css`. Do not treat Tailwind's built-in raw palette utilities as the source of truth for app colors.

## Repo Rules

- Do not force a full token or dark-mode migration as part of unrelated architecture work.
- Preserve the existing visual language unless the task scope includes design-system changes.
- When theme work is in scope, prefer semantic tokens over uncontrolled per-component palette sprawl.
- Token names must describe stable design-system meaning, not one screen, one CTA, one workflow, or one temporary UI story.
- Express reusable theme decisions through the Tailwind-driven styling system instead of introducing parallel styling approaches.
- Define and maintain shared color tokens in `apps/web/src/index.css`, then consume those tokens through Tailwind-facing semantic utilities.
- Treat `apps/web/src/index.css` as the mandatory source for reusable app colors. Tailwind classes should reference the app token system, not bypass it with built-in raw palette colors.
- Treat spacing as part of the visual system. Repeated spacing patterns should be standardized through Tailwind scale choices and shared composition rules, not recreated ad hoc in each slice.
- Treat clickable surface borders as part of the interaction system. If a control is visually clickable and uses a border, that border should come from the `primary` token family unless the component is intentionally communicating another semantic state such as destructive or success.

## FSD Spacing Ownership

- `shared` owns reusable spacing primitives, layout wrappers, container widths, stack patterns, and the default spacing rhythm used across the app.
- `entities` may apply spacing that is intrinsic to one domain concept, but should not define app-wide layout rhythm.
- `features` may compose shared spacing primitives for one user flow, but should not create competing global spacing conventions.
- `widgets` may control section-level spacing between the blocks they compose, while still aligning to the shared spacing scale.
- `pages` may decide overall page composition and vertical section rhythm, but should not introduce one-off spacing values that bypass the shared system.
- If a spacing rule is reused across slices, move it down to the narrowest shared owner instead of duplicating utility combinations.

## Do

- Centralize reusable visual decisions when a design-system task is active.
- Prefer semantic naming for broadly reused colors.
- Name tokens by durable UI role or state such as `primary`, `surface`, `muted`, `destructive`, `success`, `warning`, `ring`, or another cross-app semantic.
- Keep shared tokens in global styling infrastructure, not scattered across feature files.
- Introduce token work incrementally when it clearly reduces duplication.
- Apply theme and color decisions through Tailwind classes, Tailwind theme extensions, or shared Tailwind-compatible token sources.
- Add or update reusable color tokens in `apps/web/src/index.css` before using them in components.
- Use semantic Tailwind color utilities backed by the shared token system instead of raw palette utilities such as `bg-red-500`, `text-blue-600`, or `border-zinc-200`.
- Use `primary`-backed border utilities for interactive controls such as inputs, outlined buttons, selectable cards, and other clickable bordered surfaces unless a different semantic state is explicitly required.
- Use the Tailwind spacing scale consistently for padding, margin, gap, and section rhythm.
- Prefer a small, repeatable set of spacing steps for similar UI patterns so cards, forms, lists, and panels feel related.
- Promote repeated spacing combinations into shared primitives or wrapper components when the same layout rhythm appears in multiple FSD slices.
- Let lower layers solve local internal spacing, and let upper layers control composition spacing between larger blocks.

## Do Not Do

- Do not block architecture changes on a full theme rewrite.
- Do not mix a new token system with many one-off local color exceptions.
- Do not push page-specific color rules into shared styling primitives without reuse.
- Do not introduce separate CSS/SCSS/CSS-in-JS theme layers for new work when the same outcome should live in the Tailwind system.
- Do not use Tailwind magic colors such as `bg-slate-100`, `text-red-500`, `border-blue-300`, or similar raw palette classes as app color decisions.
- Do not add a new reusable app color directly inside a component before defining it in `apps/web/src/index.css`.
- Do not create highly specialized tokens tied to a single feature, CTA, or screen language such as `create-accent`, `import-accent`, `project-list-blue`, `error-surface`, or similar usage-specific names when a broader semantic token should exist instead.
- Do not encode one component mood, one page headline, or one action label into the token name. If the name stops making sense outside that one UI context, it is the wrong token.
- Do not style clickable bordered surfaces with unrelated neutral border tokens by default when the interaction language is supposed to be anchored to `primary`.
- Do not sprinkle arbitrary spacing values across `pages`, `widgets`, `features`, and `entities` when the same rhythm can come from the shared spacing scale.
- Do not let lower FSD layers encode page-level outer spacing that should be decided by widgets or pages.
- Do not use one-off Tailwind arbitrary spacing values unless there is a clear design constraint that the standard scale cannot satisfy.
- Do not duplicate the same spacing utility groups in multiple slices when a shared wrapper or primitive is the real owner.

## Review Standard

Flag the implementation if:

- a structural refactor silently turns into a broad visual redesign
- theme changes are introduced without a clear shared benefit
- token work adds more local exceptions than it removes
- new theme work bypasses Tailwind without an explicit compatibility reason
- reusable color work bypasses `apps/web/src/index.css`
- raw Tailwind palette colors are used as app-level color decisions instead of semantic token-backed utilities
- token names are scoped to one feature, one page, or one action instead of a stable cross-app semantic role
- clickable bordered surfaces use non-semantic or non-primary border colors without a clear semantic exception
- repeated spacing patterns are copied across FSD slices instead of being centralized at the right owner
- lower layers define outer layout spacing that should belong to widgets or pages
- arbitrary spacing values are used without a clear design reason
