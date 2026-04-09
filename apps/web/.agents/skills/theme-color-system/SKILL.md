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

## ⚠️ Semantic Color Usage — Non-Negotiable Rule

**A token that fits visually is not enough. Every token used must be semantically justified.**

Before applying any color token, you must answer: *"Why does this UI element deserve this semantic role?"* If the answer is "it looks good" or "the color matches", stop — that is the wrong reason.

Concrete examples of what this rule forbids:

- Using `text-destructive-border` for an error indicator on a dark surface because `#fecdd3` happens to be light rose — the `-border` suffix is a structural token for bordered surfaces, not a text-on-dark token.
- Using `from-secondary-icon to-tertiary-icon` for a gradient because the colors look nice together — `secondary-icon` and `tertiary-icon` are icon foreground tokens, not gradient palette values.
- Using `text-success-border` for a success check icon because `#86efac` is a light green — `-border` is a border token, not an icon color token.
- Using `bg-secondary` for a badge because sky-blue happens to match the brand — only use `secondary` if the element semantically belongs to the secondary interaction family.

**The correct mental model:**

1. What is this UI element communicating? (state, role, hierarchy, intent)
2. Which token family represents that communication? (`muted` for passive, `success` for positive outcome, `destructive` for irreversible actions, `chrome` for app shell, `brand-surface` for branded panels, etc.)
3. Within that family, which slot is appropriate? (`-foreground` for text on the family's surface, `-icon` for icon color, `-border` for border, `-text` for standalone text)

If no existing family maps to the element's semantic role, add a new token family with a stable semantic name — do not borrow a structurally mismatched token just because it produces the right hex value.

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
- For reusable primitives under `apps/web/src/shared/ui`, prefer a variant-first API before introducing custom Tailwind props, local color overrides, or one-off style booleans.
- Keep visual-system implementation details such as variant mapping, hover rules, border behavior, muted surfaces, and icon wrappers inside `shared/ui` primitives. Callers in `pages` and `modules` should consume the primitive API, not reimplement each variant manually.
- Interactive affordances in `shared/ui` must read as interactive in their base state too. Hover should strengthen discoverability, not create it from nothing.
- Clickable primitives and clickable subparts must also communicate interactivity through cursor semantics. Use pointer-style cursor behavior for interactive affordances, and ensure disabled states do not keep the interactive cursor.
- Destructive token families are reserved for destructive actions. `cancel`, `close`, `dismiss`, and similar routine dismissal actions should generally stay in neutral, `default`, `secondary`, or `tertiary` families unless the action itself is destructive.
- Unless the task explicitly asks for a different theme, `default` should remain the first-choice variant for the app's general UI. Treat `default` as the baseline primary family and opt into other families only for clear semantic reasons.

## Primitive Variant Rules

- Treat `shared/ui` as the UI library layer. Cross-app visual variants belong here, not in feature-level wrappers.
- Prefer a stable variant vocabulary for reusable controls. For button-like primitives, `default`, `secondary`, and `tertiary` should be the first-choice semantic action variants before introducing new visual families.
- Interpret `default` as the primary action family. If design discussions say "primary button", that should usually map to the `default` variant in the primitive API unless the component already exposes a different established contract.
- Use semantic variants intentionally. Positive forward actions such as `create`, `add`, `save new`, or `confirm` may map to `tertiary` or `success` when that semantic emphasis improves clarity. Routine neutral actions such as `cancel`, `close`, `dismiss`, and `back` should usually stay in `default` or `secondary`. Destructive actions such as `delete`, `remove`, or irreversible `reset` should use `destructive`.
- Treat `success` as the reusable positive-semantic family for clearly affirmative states, outcomes, or forward actions. Use it when the UI should read as intentionally positive, not merely different.
- Treat `muted` as the reusable passive-semantic family for empty states, no-data shells, read-only support regions, and other intentionally low-emphasis UI. Use it when the surface should recede behind the app's mostly-`default` interactive controls.
- Add destructive, outline, ghost, or link-like variants only when the component actually needs those semantics. Do not copy the full variant matrix into every primitive by default.
- When a primitive exposes variants, each variant should own its background, foreground, border, icon surface, icon color, and hover state through the shared token system.
- If the primitive supports icons, prefer a single internal rendering path per side. For example, a wrapped semantic icon path and an escape hatch component path can coexist, but they should be mutually exclusive on the same side to keep behavior deterministic.
- If a primitive needs an opt-out such as `hoverable={false}` or `noBorder`, encode that behavior once in the primitive and keep consuming slices free from repeated conditional Tailwind logic.
- Default `hoverable={false}` on non-clickable primitive surfaces. Keep hover enabled by default only for interactive affordances such as buttons, triggers, menu items, links, and checkbox controls.
- If a primitive contains clickable subparts such as triggers, row actions, close buttons, menu items, add/remove controls, or inline action chips, those subparts should own a semantic resting surface so they remain identifiable before hover.

## Variant-First Before Custom Tailwind

- When extending a reusable primitive, first check whether the need fits an existing variant such as `default`, `secondary`, or `tertiary`.
- If the primitive already exposes `success` or `muted`, prefer those variants over custom Tailwind color overrides when the UI need is positive-semantic or passive-semantic.
- If the need is still part of the primitive's reusable visual language, add or refine a variant instead of requiring consumers to pass raw class overrides.
- Only fall back to custom `className` styling for truly local layout adjustments or one-off composition details.
- Do not solve a missing semantic state by telling consumers to stack raw classes like `bg-*`, `hover:bg-*`, `border-*`, and `text-*` on top of a primitive. Add or correct the primitive contract instead.

## Token Mapping Guidance

- Define reusable color families in `apps/web/src/index.css` with a consistent semantic structure.
- For action-oriented variants, prefer a token family shape like:
- `--color-<variant>`
- `--color-<variant>-hover`
- `--color-<variant>-foreground`
- `--color-<variant>-border`
- `--color-<variant>-border-hover`
- `--color-<variant>-muted`
- `--color-<variant>-muted-hover`
- `--color-<variant>-icon`
- `--color-<variant>-text`
- Use the base token for the control surface, the `foreground` token for text on that surface, the `border` tokens for outlined or bordered interaction states, and the `muted` tokens for softer internal surfaces such as icon containers.
- Use the `icon` token for icon color when the icon should follow the variant semantics. This is especially useful for Lucide icons because they follow `currentColor`.
- Keep hover tokens separate from base tokens. Do not assume hover can always be derived by opacity tricks or raw palette adjustments inside the component.
- If a variant family exists in `index.css`, consume it from the primitive rather than recreating equivalent Tailwind arbitrary values.
- For passive empty states and non-clickable support regions, prefer the existing muted family before inventing a page-specific neutral tone. Start with `--color-muted`, `--color-muted-foreground`, and `--color-border-subtle`, or the primitive's `*-muted` family, so empty shells read softer than the app's mostly-`default` interactive controls.

## Hover And Border Semantics

- `hoverable`-style flags should disable both the primitive's own hover styles and any internal hover-coupled visuals such as icon wrapper hover backgrounds.
- Hover behavior should remain semantic. Root hover states should come from `--color-<variant>-hover` and related border hover tokens when those states are part of the design language.
- Distinguish between the main control surface and internal decorative or supportive surfaces. For example, a button root may use `--color-primary-hover` while an internal icon wrapper uses `--color-primary-muted-hover`.
- In mixed primitives, apply hover tokens only to interactive subparts by default. Shells like card bodies, alert surfaces, dialog containers, accordion shells, and dropdown content wrappers should not inherit hover just because they contain an action inside.
- `noBorder`-style flags should be treated as structural opt-outs from the primitive's border system. When active, the primitive should suppress variant border rendering rather than asking consumers to patch over borders manually.
- Borderless mode should not force consumers to re-specify hover, background, or icon behavior. The primitive should remain visually coherent when the border is removed.
- For clickable descendants, the base state should usually provide enough contrast to separate the control from its background through semantic surface, semantic border, and when appropriate subtle elevation such as `shadow-sm`.
- Hover is a reinforcement layer. It may intensify surface, border, icon, or motion, but it should not be the only reason a control becomes discoverable.
- Cursor feedback is part of hover semantics for interactive controls. Clickable roots and clickable descendants should switch to an interactive cursor on hover, while disabled or non-clickable surfaces should keep non-interactive cursor behavior.
- Do not map dismissive actions to destructive surface, border, hover, or icon tokens unless the action itself is destructive.
- Passive shells such as `no data`, `empty`, `no project`, and read-only support regions should generally be quieter than primary action surfaces. Keep them in muted families unless the task explicitly asks for stronger emphasis.

## Ownership Boundary

- These variant and token rules are primarily for `apps/web/src/shared/ui` and other library-like reusable primitive layers.
- `modules` and `pages` may choose which variant to use, but they should not become the home of per-variant implementation logic.
- If multiple consuming modules need the same visual behavior, move that behavior into the primitive or a shared wrapper under `shared`, not into repeated module-level class strings.
- A consuming slice may compose primitives and choose semantics such as `variant="secondary"` or `hoverable={false}`, but the slice should not define what `secondary` means in raw Tailwind terms.

## Spacing Ownership

- `shared` owns reusable spacing primitives, layout wrappers, container widths, stack patterns, and the default spacing rhythm used across the app.
- `modules` may apply spacing that is intrinsic to one business area, but should not define app-wide layout rhythm.
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
- Prefer implementing reusable variant families such as `default`, `secondary`, and `tertiary` in the primitive instead of expecting consumers to recreate them.
- Keep per-variant hover, border, foreground, and icon-color logic colocated with the primitive that owns the variant API.
- Use `hoverable`-style flags to disable all related hover visuals consistently, including nested icon or badge surfaces that react to parent hover.
- Use `noBorder`-style flags as primitive-owned switches for border suppression when the component needs a reusable borderless mode.
- For icon-supporting primitives, provide semantic icon coloring through token-backed `text-*` classes when the icon should inherit variant meaning.
- Make clickable controls visually discoverable at rest through semantic contrast, not only through hover.
- Make clickable controls cursor-discoverable as well. Interactive controls should expose pointer-style cursor behavior, and disabled controls should suppress that affordance.
- Keep destructive semantics tied to destructive outcomes, not to generic dismissal labels.
- Keep the broad application theme anchored to `default` unless the screen or task explicitly calls for another semantic family.
- Use existing muted token families for empty-state and passive support UIs so they remain visually subordinate to primary/default controls.
- Use the Tailwind spacing scale consistently for padding, margin, gap, and section rhythm.
- Prefer a small, repeatable set of spacing steps for similar UI patterns so cards, forms, lists, and panels feel related.
- Promote repeated spacing combinations into shared primitives or wrapper components when the same layout rhythm appears in multiple modules or pages.
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
- **Do not pick a token because its resolved hex value looks correct.** Visual match is not semantic correctness. A `-border` token on text, an `-icon` token as a gradient stop, or a `secondary` family applied to something unrelated to the secondary interaction concept are all wrong regardless of how they render.
- Do not use structural token slots (`-border`, `-icon`, `-muted`) in roles they were not designed for just to reach a target color. If the right color does not exist under the right semantic slot, define it properly.
- Do not style clickable bordered surfaces with unrelated neutral border tokens by default when the interaction language is supposed to be anchored to `primary`.
- Do not bypass an existing primitive variant system by manually restyling the component from consuming slices.
- Do not add one boolean per screen for visual tweaks when the real problem is that the primitive is missing a reusable semantic variant or opt-out.
- Do not implement the same `default/secondary/tertiary` mapping separately in module or page code.
- Do not let `hoverable={false}` disable only the root hover while nested hover-coupled visuals still react.
- Do not leave clickable controls or clickable descendants on default text cursor behavior when they are intended to be interactive, and do not keep pointer cursor semantics on disabled controls.
- Do not enable hover on non-clickable surfaces just to make them feel active. Hover is an interaction signal first, not ambient decoration.
- Do not use raw icon color overrides in consumers when the primitive already owns semantic icon coloring.
- Do not hide interactive affordances inside flat passive surfaces until the user happens to hover them.
- Do not style `cancel`, `close`, or `dismiss` controls with destructive token families unless they actually perform a destructive action.
- Do not let passive empty-state or no-data surfaces share the same visual weight as `default` interactive controls.
- Do not shift routine page chrome to `secondary`, `tertiary`, or other families when `default` should remain the baseline theme.
- Do not sprinkle arbitrary spacing values across `pages` and `modules` when the same rhythm can come from the shared spacing scale.
- Do not let modules encode page-level outer spacing that should be decided by pages.
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
- a token is chosen because its resolved color value visually matches, not because its semantic role matches
- a structural token slot (`-border`, `-icon`, `-muted`) is applied in a role it was not designed for (e.g. `-border` used as text color, `-icon` used as gradient stop)
- token names are scoped to one feature, one page, or one action instead of a stable cross-app semantic role
- clickable bordered surfaces use non-semantic or non-primary border colors without a clear semantic exception
- a reusable primitive is being extended with ad hoc custom classes when the need should be covered by a stable variant or primitive-owned boolean such as `hoverable` or `noBorder`
- consuming slices reimplement primitive variant meanings instead of using the shared variant API
- hover disabling is partial and internal hover-linked visuals still change when the primitive claims hover is off
- interactive controls lack pointer-style cursor feedback, or disabled controls still present interactive cursor affordance
- variant families exist in `index.css` but the primitive bypasses them with local hard-coded Tailwind palette values
- icon-supporting primitives rely on manual consumer icon coloring instead of semantic token-backed inheritance where appropriate
- interactive affordances are not visually separable from their background until hover occurs
- destructive tokens are used for `cancel`, `close`, `dismiss`, or similar non-destructive actions
- general app UI defaults to non-`default` variants without an explicit semantic reason
- passive empty-state or no-data regions are styled with the same emphasis as primary interactive controls instead of the muted family
- repeated spacing patterns are copied across modules and pages instead of being centralized at the right owner
- modules define outer layout spacing that should belong to pages
- arbitrary spacing values are used without a clear design reason
