---
name: theme-color-system-web
description: Scope is apps/web (web frontend). Optional guidance for theming and color tokens in the web app. Use only when the task is explicitly about visual system work; do not treat theme token migration as a required part of the architecture refactor. Trigger this skill for any theming or color token work under `apps/web`.
---

# Theme Color System Web

> **Scope:** `apps/web` (web frontend). This skill applies only to code under `apps/web`.

## Purpose

Use this skill when a task is explicitly about visual system cleanup, theming, or tokenization. The skill is optional and is not a blocking rule for structural architecture work — do not block or force a full token or dark-mode migration as part of unrelated refactors. Introduce token work incrementally when it clearly reduces duplication, and preserve the existing visual language unless the task scope is design-system changes.

When theme work is in scope, apply it through Tailwind-based styling. Tailwind is the required styling path unless a task is explicitly constrained by an existing non-Tailwind surface. Do not introduce separate CSS/SCSS/CSS-in-JS theme layers for new work. All reusable color decisions must come from the shared token source in `apps/web/src/index.css`; do not treat Tailwind's built-in raw palette utilities as the source of truth for app colors.

## Visual Design Philosophy

The app's visual language is corporate, minimal, and purposeful. Every visual element must serve a function. Decoration that does not communicate state, hierarchy, or intent should be removed. Four principles govern all design decisions:

1. **Clarity through structure**: Use whitespace, typographic hierarchy, and semantic color to create visual order. Do not compensate for weak structure with color noise, decorative gradients, or shadow layers.
2. **Whitespace over density**: Prefer generous padding and breathing room between elements. Compactness should come from purposeful information density, not from eliminating necessary space.
3. **Borders over shadows**: Surface separation is communicated through subtle borders and background tokens, not elevation shadows. Use `shadow-sm` at most for surfaces that need clear physical separation from the page (dropdowns, popovers, modals). All other surfaces rely on border and background contrast.
4. **Typography carries hierarchy**: Text weight, size, and color contrast establish visual order. Color alone must not be the sole differentiator between hierarchy levels — typographic weight or size must agree.

These principles are not constraints to work around; they are the intended output. An interface that feels open, readable, and structured is the goal.

## Semantic coloring (chromatic families)

**Semantic coloring** means color is chosen so the user reads a **stable meaning** (outcome, risk, information type, or failure) — not merely depth, brand decoration, or “this chip looks nice.” In `apps/web/src/index.css`, that meaning is carried only by the **chromatic semantic families** below (plus `muted` / `default` when something must stay deliberately neutral).

| Family | Communicates |
|--------|----------------|
| **`success`** | Positive outcome, completion, validation passed, healthy or published state, or intentional affirmative emphasis where a green read is correct. |
| **`info`** | Informational emphasis: hints, context, non-blocking notices — neither success nor danger. |
| **`warning`** | Caution, needs attention, pending or degraded state that is not yet a hard failure. |
| **`destructive`** | Errors, failures, blocked validation, or irreversible / dangerous actions — red read is intentional. |

Each family has coordinated tokens (`-surface`, `-border`, `-border-hover`, `-text`, `-icon`, `-muted`, …). Choose slots by **element role** (surface vs border vs label text vs icon), not by whichever hex happens to match a mockup.

**Primitives that must lean on semantic coloring:** **`Badge`**, **`TagEditor`**, and similar **pills, chips, and inline labels** that encode **state, category, or validation**. When the label means “ok / failed / warn / FYI”, the variant must be **`success`**, **`destructive`**, **`warning`**, or **`info`** (or **`muted`** when explicitly passive). Do **not** use `secondary` / `tertiary` there to fake green, red, amber, or blue meaning — those variants are **structural** (nesting / neutral emphasis); see *Structural nesting vs semantic state*. **Structural choice (separate from hue):** use **`TagEditor`** when entries behave as **chips** (keywords, small sets, reorder-by-tag UX). Use a **line-delimited `Textarea`** pattern for **bulk technical lists** (many homogeneous keys, paste-friendly lines) — see *Line-delimited string[] fields (Textarea vs TagEditor)*.

## ⚠️ Semantic Color Usage — Non-Negotiable Rule

**A token that fits visually is not enough. Every token used must be semantically justified.**

Before applying any color token, answer: *"Why does this UI element deserve this semantic role?"* If the answer is "it looks good" or "the color matches", stop — that is the wrong reason.

Concrete examples of what this rule forbids:

- Using `text-destructive-border` for an error indicator on a dark surface because `#fecdd3` happens to be light rose — `-border` is a structural token for bordered surfaces, not a text-on-dark token.
- Using `from-secondary-icon to-tertiary-icon` for a gradient because the colors look nice together — `*-icon` tokens are icon foregrounds, not gradient palette values.
- Using `text-success-border` for a success check icon because `#86efac` is a light green — `-border` is a border token, not an icon color token.
- Using `bg-secondary` or `bg-tertiary` for a **status** or **outcome** badge (for example “published”, “valid”, “error”) because the tint looks pleasant — outcome and validation semantics belong in **`success`**, **`info`**, **`warning`**, or **`destructive`**, not in structural `secondary` / `tertiary` surfaces.

**The correct mental model:**

1. What is this UI element communicating? (state, role, hierarchy, intent)
2. Which token family represents that communication? (`muted` for passive, **`secondary` / `tertiary` for nested structural surfaces** — see *Structural nesting vs semantic state*, **`success` / `info` / `warning` / `destructive` for semantic coloring** — see *Semantic coloring (chromatic families)*, `chrome` for app shell, `brand-surface` for branded panels, etc.)
3. Within that family, which slot is appropriate? (`-foreground` for text on the family's surface, `-icon` for icon color, `-border` for border, `-text` for standalone text)

### Structural nesting vs semantic state

The **`secondary`** and **`tertiary`** families in `apps/web/src/index.css` are defined primarily for **structural hierarchy**: nested cards, inset panels, accordions, and other “container inside container” layouts (for example a dialog scroll area with a white `default` card and a deeper **`tertiary`** sub-card). They signal **depth and grouping** through neutral background and border steps — not product meaning.

- **Typical surface stack:** `default` (baseline white / primary family on cards) → first inset **`secondary`** → second inset **`tertiary`**. Prefer **border + background contrast** over stacking heavy shadows on nested panels; inner nested cards often omit shadow when the parent already separates from the page.
- **Dialog / panel outer shell:** **`DialogContent`** (and similar modal or inspector shells) should use **`variant="default"`** as the **baseline** surface unless the product deliberately themes the whole shell with a semantic variant. Section **`Card`**s inside that shell use **`secondary`** for the **first** structural inset. Use **`tertiary` on `Card` only when one card nests inside another card** (second inset). Do not put the outermost section cards in `tertiary` on a `default` dialog — that skips the secondary step and flattens the depth ladder. Optional header strips (e.g. “config missing” notices) may use **`info`** (or other chromatic families) where **messaging semantics** apply; that is not a substitute for keeping the dialog body on **`default`**; on **`default`** dialog shells, nested section **`Card`**s often use **`shadow-none`** so elevation does not stack with the modal chrome — see *Elevation and Surface Depth*.
- **Wide dialog / two-column layout:** Order **section `Card`s** so **reading flow and dependency match** — e.g. keep configuration that logically follows “dependencies” **in the same column**, directly under that card, rather than splitting related blocks across columns without reason. **`exports`-style** wide single-owner panels may occupy the **other** column.
- **Field primitives inside structural cards:** **`Input`**, **`Textarea`**, **`Select`**, **`TagEditor`**, and other **data-entry** primitives should **stay on `variant="default"`** for normal editable fields. **Do not** mirror the parent **`Card`**’s `secondary` / `tertiary` on these controls “so they match the panel” — **containers carry nesting depth; controls keep the standard field chrome** unless the field itself has a semantic job. **Exceptions:** **`muted`** (or equivalent) for **read-only** or intentionally **low-emphasis** fields; **`destructive`** / error presentation for **invalid** input; **`info`** (or other chromatic variants) only when that **control surface** is explicitly an informational callout, not merely because it sits on a tinted card. **`Button`** / **`DialogCancelButton`** variants follow **action semantics** (primary weight, cancel, destructive delete) and likewise **do not** need to echo the enclosing `Card` variant.
- **Semantic coloring** (positive outcome, risk, caution, informational emphasis) must use the dedicated families in `index.css`: **`success`**, **`info`**, **`warning`**, and **`destructive`**, with slots (`-surface`, `-border`, `-text`, `-icon`, …) chosen for the element’s role — see *Semantic coloring (chromatic families)*. Do not repurpose `secondary` / `tertiary` to imply success, danger, warning, or info — users will misread them.

**Interaction primitives** (`Button`, `DialogCancelButton`, inputs with `variant="secondary"` | `"tertiary"`, etc.) reuse the same token names for **neutral action emphasis** (secondary/tertiary control weight). Token **values** stay calm and structural so cards and controls stay coherent. When in doubt: *nested shell vs semantic message?* — nested shell → `secondary` / `tertiary` surfaces; message → `success` / `info` / `warning` / `destructive`.

Do not use structural token slots (`-border`, `-icon`, `-muted`) in roles they were not designed for just to reach a target color. If no existing family maps to the element's semantic role, add a new token family with a stable, cross-app semantic name — do not borrow a structurally mismatched token because it produces the right hex value, and do not create usage-specific tokens like `create-accent`, `import-accent`, `project-list-blue`, or `error-surface` when a broader semantic token should exist instead. If a name stops making sense outside one UI context, it is the wrong token.

## Repo Rules

- Define and maintain shared color tokens in `apps/web/src/index.css`, and consume them through Tailwind-facing semantic utilities. Do not add a new reusable app color directly inside a component before defining it in `apps/web/src/index.css`, and do not use raw Tailwind palette classes (`bg-slate-100`, `text-red-500`, `border-blue-300`, `text-zinc-400`, etc.) as app-level color decisions.
- Token names must describe stable design-system meaning, not one screen, one CTA, one workflow, or one temporary UI story. Push page-specific color rules back into sections when reuse is proven, not forward into shared primitives without reuse.
- When adding a new token in `apps/web/src/index.css`, add a short nearby code comment that states the token family's general intended usage. Describe broad ownership or UI area (e.g. `canvas surfaces`, `nodes inside canvas`, `sidebar chrome`, `form validation states`), not one-off component instances.
- Treat spacing as part of the visual system (see *Spacing Ownership*). Repeated spacing patterns should be standardized through Tailwind scale choices and shared composition rules, not recreated ad hoc in each slice.
- Treat clickable surface borders as part of the interaction system. If a control is visually clickable and uses a border, that border should come from the `primary` token family unless the component is intentionally communicating another semantic state such as destructive or success.
- For reusable primitives under `apps/web/src/shared/ui`, prefer a variant-first API before introducing custom Tailwind props, local color overrides, or one-off style booleans. Keep visual-system implementation details (variant mapping, hover rules, border behavior, muted surfaces, icon wrappers) inside `shared/ui` primitives; callers in `pages` and `modules` should consume the primitive API, not reimplement each variant manually.
- Interactive affordances in `shared/ui` must read as interactive in their base state too. Hover strengthens discoverability; it must not create it from nothing.
- Destructive token families are reserved for destructive actions. `cancel`, `close`, `dismiss`, and similar routine dismissal actions stay in neutral, `default`, `secondary`, or `tertiary` families unless the action itself is destructive.
- Unless the task explicitly asks for a different theme, `default` is the first-choice variant for the app's general UI. Treat `default` as the baseline primary family and opt into other families only for clear semantic reasons.

## Token Mapping Guidance

- Define reusable color families in `apps/web/src/index.css` with a consistent semantic structure. For action-oriented variants, prefer a token family shape like:
  - `--color-<variant>`
  - `--color-<variant>-hover`
  - `--color-<variant>-foreground`
  - `--color-<variant>-border`
  - `--color-<variant>-border-hover`
  - `--color-<variant>-muted`
  - `--color-<variant>-muted-hover`
  - `--color-<variant>-icon`
  - `--color-<variant>-text`
- Use the base token for the control surface, `foreground` for text on that surface, `border` tokens for outlined or bordered interaction states, `muted` tokens for softer internal surfaces (like icon containers), and `icon` for icon color when the icon should follow the variant semantics (especially valuable for Lucide icons because they follow `currentColor`).
- Keep hover tokens separate from base tokens. Do not assume hover can be derived by opacity tricks or raw palette adjustments inside the component.
- If a variant family exists in `index.css`, consume it from the primitive rather than recreating equivalent Tailwind arbitrary values. Variants existing in `index.css` but bypassed with local hard-coded Tailwind palette values inside primitives is a direct violation.
- For passive empty states and non-clickable support regions, start with the existing muted family (`--color-muted`, `--color-muted-foreground`, `--color-border-subtle`, or the primitive's `*-muted` family) before inventing a page-specific neutral tone, so empty shells read softer than the app's mostly-`default` interactive controls.
- When designing foreground/background token pairings in `index.css`, ensure the pairing meets WCAG AA contrast minimums. Normal text tokens must achieve 4.5:1. Large-text and UI control tokens must achieve at least 3:1. This is a baseline expectation, not an opt-in.

## Primitive Variant Rules

- Treat `shared/ui` as the UI library layer. Cross-app visual variants belong here, not in feature-level wrappers. Do not implement the same `default/secondary/tertiary` mapping separately in module or page code.
- Prefer a stable variant vocabulary for reusable controls. For button-like primitives, `default`, `secondary`, and `tertiary` are the first-choice **interaction emphasis** variants (not chromatic status). Interpret `default` as the primary action family — "primary button" in design discussions usually maps to `variant="default"`.
- For **container** primitives (`Card`, `Section`, nested dialog panels), `variant="secondary"` and `variant="tertiary"` mean **inset surface level** — see *Structural nesting vs semantic state*. Do not choose them to add decorative color; choose them to show one container inside another without implying `success` / `warning` / etc.
- Use semantic variants intentionally:
  - Positive forward actions (`create`, `add`, `save new`, `confirm`) use `variant="default"` or `variant="success"` when affirmative semantics matter — do not use `tertiary` or `secondary` button variants to stand in for **success** messaging; use the **`success`** token family where the UI must read as clearly positive/chromatic.
  - Routine neutral actions (`cancel`, `close`, `dismiss`, `back`) stay in `default` or `secondary` (interaction weight).
  - Destructive actions (`delete`, `remove`, irreversible `reset`) use `destructive`.
- Treat `success` as the reusable positive-semantic family for clearly affirmative states, outcomes, or forward actions. Selected states in option pickers (scope selectors, type pickers, toggle-button groups) are a canonical use case: use `variant="success"` on the shared `Button` primitive. Do not hand-roll selection with raw token stacks like `border-primary-border-hover bg-primary-muted text-primary-text`.
- Treat `muted` as the reusable passive-semantic family for empty states, no-data shells, read-only support regions, and other intentionally low-emphasis UI. Do not let passive shells share the same visual weight as `default` interactive controls.
- Add destructive, outline, ghost, or link-like variants only when the component actually needs those semantics. Do not copy the full variant matrix into every primitive by default.
- When a primitive exposes variants, each variant owns its background, foreground, border, icon surface, icon color, and hover state through the shared token system. Per-variant hover, border, foreground, and icon-color logic lives colocated with the primitive.
- If the primitive supports icons, prefer a single internal rendering path per side. A wrapped semantic icon path and an escape hatch component path can coexist, but must be mutually exclusive on the same side to keep behavior deterministic. When the icon should inherit variant meaning, provide semantic icon coloring through token-backed `text-*` classes; do not use raw icon color overrides in consumers.
- If a primitive needs an opt-out like `hoverable={false}` or `noBorder`, encode that behavior once in the primitive so consuming slices stay free of repeated conditional Tailwind logic. Do not add one boolean per screen for visual tweaks when the real problem is a missing reusable variant or opt-out.
- Default `hoverable={false}` on non-clickable primitive surfaces. Keep hover enabled by default only for interactive affordances (buttons, triggers, menu items, links, checkbox controls). Do not enable hover on non-clickable surfaces just to make them feel active — hover is an interaction signal first, not ambient decoration.
- If a primitive contains clickable subparts (triggers, row actions, close buttons, menu items, add/remove controls, inline action chips), those subparts own a semantic resting surface so they remain identifiable before hover.

## Variant-First Before Custom Tailwind

- When extending a reusable primitive, first check whether the need fits an existing variant (`default`, `secondary`, `tertiary`, `success`, `muted`). If the need is still part of the primitive's reusable visual language, add or refine a variant instead of requiring consumers to pass raw class overrides.
- Only fall back to custom `className` styling for truly local layout adjustments or one-off composition details.
- Do not solve a missing semantic state by telling consumers to stack raw classes (`bg-*`, `hover:bg-*`, `border-*`, `text-*`) on top of a primitive. Add or correct the primitive contract instead.
- Do not bypass an existing primitive variant system by manually restyling the component from consuming slices.

## Hover, Border, and Cursor Semantics

- Hover is a reinforcement layer. It may intensify surface, border, icon, or motion, but it must not be the only reason a control becomes discoverable. For clickable descendants, the base state should provide enough contrast to separate the control from its background through semantic surface, semantic border, and when appropriate subtle elevation (`shadow-sm`).
- Root hover states come from `--color-<variant>-hover` and related border-hover tokens. Distinguish the main control surface from internal decorative or supportive surfaces: a button root may use `--color-primary-hover` while an internal icon wrapper uses `--color-primary-muted-hover`.
- In mixed primitives, apply hover tokens only to interactive subparts by default. Shells (card bodies, alert surfaces, dialog containers, accordion shells, dropdown content wrappers) should not inherit hover just because they contain an action inside.
- `hoverable`-style flags must disable both the primitive's own hover styles and any internal hover-coupled visuals (icon wrapper hover backgrounds, etc.). Partial disabling, where nested hover-coupled visuals still react, is a defect.
- `noBorder`-style flags are structural opt-outs from the primitive's border system. When active, the primitive suppresses variant border rendering rather than asking consumers to patch over borders manually, and must remain visually coherent (hover, background, icon behavior) with the border removed.
- Cursor feedback is part of hover semantics. Clickable roots and clickable descendants switch to a pointer-style cursor on hover; disabled or non-clickable surfaces keep non-interactive cursor behavior. Interactive controls without pointer cursor, or disabled controls still presenting pointer cursor, are defects.
- Do not map dismissive actions (`cancel`, `close`, `dismiss`) to destructive surface, border, hover, or icon tokens unless the action itself is destructive.
- Do not style clickable bordered surfaces with unrelated neutral border tokens by default when the interaction language should be anchored to `primary`.

### `Button` `leftIconComponent` / `rightIconComponent` (custom icon slot)

- In `apps/web/src/shared/ui/Button.tsx`, the root element exposes the Tailwind named group `group/button`. The default `leftIcon` / `rightIcon` path renders through an internal wrapper (`buttonIconVariants`, `buttonIconMotionVariants`) so icon surfaces and motion stay coupled to button hover and to `hoverable` / `noIconHover`.
- When you pass **`leftIconComponent` or `rightIconComponent`**, that internal wrapper is **not** applied to your node. The custom subtree must **stay visually coupled to the button hover**; otherwise the leading/trailing visual freezes while the root uses variant hover tokens (for example `--color-primary-hover`), which reads as broken interaction design.
- **Coupling rule:** drive hover styles from the **button root**, not from `hover:` on the inner slot alone. Use **`group-hover/button:`** utilities on the custom icon container (and on any nested accent box) so hover matches pointer intent over the whole control, including when focus is on the button.
- **Token rule:** treat the custom slot like any other semantic surface. For example, an informational accent tile next to primary action text uses the shared **`info`** family at rest (`border-info-border`, `bg-info-surface`, `text-info-icon`) and on root hover adds **`group-hover/button:border-info-border-hover`** and **`group-hover/button:bg-info-hover`**. Use the **`-border-hover` / `-hover`** slots from the same semantic family you used at rest; do not invent raw palette hovers on the slot.
- **Motion parity:** when the button is `hoverable` (default) and not `noIconHover`, mirror the built-in icon motion on the same side: leading/custom left visual uses `group-hover/button:-translate-y-px group-hover/button:shadow-sm` with **`transition-all duration-200 ease-out`**; trailing/custom right visual uses `group-hover/button:translate-x-0.5`. When `hoverable={false}` or `noIconHover`, omit these motion and group-hover-coupled accents so disabling stays complete (see `hoverable`-style flags above).
- **Elevation nuance:** the global “borders over shadows” rule still applies to page-scale cards and panels. The shared **`Button`** icon region is the narrow exception where **`shadow-sm`** may appear **only** as part of this documented `group-hover/button` micro-interaction, in parity with the primitive’s wrapped icon path — do not escalate to `shadow-md` or heavier, or add extra shadows on the full button chrome.

## Typography and Readability

- `text-sm` (14px) is the baseline for interactive UI content: labels, form fields, list items, button text.
- `text-xs` (12px) is reserved for metadata, badges, secondary annotations, and timestamps — not for primary content or action labels.
- `text-base` or `text-lg` are for section headings within a panel or a page-level heading, not for body content.
- Typographic weight follows a simple hierarchy: `font-normal` for content, `font-medium` for the primary label of a control or section, `font-semibold` sparingly for page-level framing only.
- Use `leading-normal` or `leading-relaxed` as the default line height for multi-line text; do not collapse line-height for readability contexts.
- Typography color must come from semantic foreground tokens (`text-foreground`, `text-muted-foreground`, `text-<variant>-foreground`, `text-<variant>-text`). Do not use raw palette text colors (`text-zinc-400`, `text-slate-500`) to produce a hierarchy step.
- Do not rely on color alone to establish hierarchy between two text elements. Pair color differences with weight or size so the structure reads in grayscale.
- Do not introduce ad hoc font sizes outside the Tailwind scale. An `text-[13px]` value is a sign that `text-sm` is the correct choice. Font sizes below 12px are not used in any context.
- Keep focus ring visibility intact on all interactive controls using `ring`-family tokens. Do not suppress or remove focus rings for aesthetic reasons — focus visibility is a non-negotiable accessibility baseline.

## Icon System

Icons are typographic siblings: their size, color, and spacing follow the same semantic rules as text. Lucide is the default icon library; its stroke-based shapes follow `currentColor`, letting semantic foreground tokens drive icon color.

- Icon sizes follow the text scale: `size-3.5` (14px) next to `text-xs`, `size-4` (16px) next to `text-sm`, `size-5` (20px) next to `text-base`, `size-6` (24px) next to `text-lg`. Do not use arbitrary icon sizes (`size-[15px]`, `size-[18px]`) when the standard scale pairs correctly.
- Icon color inherits from the surrounding text context by default. Use `text-<variant>-icon` only when the icon carries distinct semantic meaning (success, destructive, warning) inside neutral text. Do not hardcode palette colors on icons.
- Keep stroke width consistent. Lucide defaults to `stroke-width: 2`. Do not mix `stroke-width: 1` and `stroke-width: 2` icons in the same surface — inconsistent stroke weight reads as visual noise.
- Icon-only interactive controls must carry `aria-label` describing the action, and must use a minimum `size-8` (32px) hit area even when the icon itself is `size-4`. Decorative icons (duplicating adjacent text meaning) are marked `aria-hidden="true"` so screen readers do not announce them twice.
- Icon + label spacing is part of the shared primitive API. Use the primitive's `leftIcon`/`rightIcon` slots rather than manually placing an icon with `gap-*` classes.
- When `Button`'s **`leftIconComponent`** or **`rightIconComponent`** escape hatch is used, follow *Hover, Border, and Cursor Semantics* → **`Button` `leftIconComponent` / `rightIconComponent` (custom icon slot)** so the custom leading/trailing visual hovers in lockstep with the control (`group-hover/button:`), using semantic token families rather than isolated `hover:` on the inner node alone.
- Do not use emoji or image-based glyphs in place of the icon system for UI meaning. Emoji rendering varies across platforms and breaks the minimal, corporate tone.

## Elevation and Surface Depth

The app uses a flat, border-first surface model. Depth is expressed through background token differences and structured borders, not shadow stacking.

- `shadow-sm` is the practical ceiling for surface elevation, reserved for dropdown menus, popovers, command palettes, and modal dialogs that must separate clearly from the document beneath. Do not use `shadow-md`, `shadow-lg`, `shadow-xl`, or heavier for cards, panels, editor regions, or sidebar sections — those surfaces are separated by border and background token contrast. Do not add `shadow-*` to buttons or bordered interactive controls for depth or 3D effect; their boundary is communicated by border tokens.
- Surface hierarchy comes from background token layering: `--color-background` for the page, **`default` / primary-style** surfaces for baseline cards, **`secondary`** then **`tertiary`** for nested inset steps (see *Structural nesting vs semantic state*), and `--color-muted` for passive supporting regions. This layering plus consistent border tokens provides sufficient visual depth without shadows.
- Avoid decorative gradients on UI surfaces. `bg-gradient-*` utilities are not part of the app's flat token model. Gradients must serve a functional role (overflow fade mask, skeleton shimmer, progress fill), and must be defined through a token-compatible approach rather than inline arbitrary colors.
- Do not introduce pattern textures, image-based backgrounds, or decorative surface treatments that are not expressed through the token system.

## Spacing Ownership

- `shared` owns reusable spacing primitives, layout wrappers, container widths, stack patterns, and the default spacing rhythm.
- `modules` may apply spacing intrinsic to one business area but do not define app-wide layout rhythm. `pages` decide overall page composition and vertical section rhythm but do not introduce one-off spacing values that bypass the shared system. If a spacing rule is reused across slices, move it down to the narrowest shared owner instead of duplicating utility combinations.
- Use the Tailwind spacing scale consistently for padding, margin, gap, and section rhythm. Prefer a small, repeatable set of spacing steps for similar UI patterns so cards, forms, lists, and panels feel related. Do not use one-off Tailwind arbitrary spacing values unless a clear design constraint the standard scale cannot satisfy exists.
- Prefer generous internal padding (`p-4`, `p-6`) for panel and card content areas unless explicitly space-constrained. Tightening to `p-2` or less to gain visual density without a deliberate reason is a defect — whitespace is not wasted space.
- Structure whitespace to create visual groups before reaching for borders, dividers, or color as separators. Spacing is the first grouping tool; borders are the second.
- Use `Card/CardHeader/CardTitle/CardDescription/CardContent` to wrap titled, sectioned panels inside editor modules — this is the established container structure. Do not structure such panels as plain divs with `border-t` dividers; ad hoc divs create visual inconsistency without semantic justification.

## Motion and Transition System

Motion in a corporate UI is functional, not decorative. Transitions exist to make state changes legible — where something came from, where it went, what just changed. They do not exist to delight, surprise, or showcase.

- Use a small duration scale: `duration-150` (hover and micro-interactions), `duration-200` (default state changes and small layout shifts), `duration-300` (entrance/exit of larger floating surfaces like modals and dropdowns). Do not use arbitrary durations (`duration-[175ms]`, `duration-[450ms]`) when the standard scale covers the need.
- Default easing: `ease-out` for entering changes (fading in, opening, appearing), `ease-in` for exiting changes (fading out, closing, disappearing). Use `ease-in-out` only for elements that both enter and exit within the same continuous gesture. Do not use elastic, spring, bounce, or back curves anywhere — they belong in marketing surfaces, not corporate tooling.
- Only animate transform-safe and paint-safe properties by default: `opacity`, `background-color`, `border-color`, `color`, `transform`. Avoid animating `width`, `height`, `top`, `left`, `margin`, `padding` unless a clear reason and performance budget exist.
- Hover transitions on interactive primitives use `duration-150` with `ease-out`; floating surface entry/exit uses `duration-200` to `duration-300` with `ease-out`/`ease-in`.
- Respect `prefers-reduced-motion`. When the user has requested reduced motion, transitions collapse to instant state changes (opacity cross-fades at most), not shortened animations.
- Motion ownership lives in the `shared/ui` primitive. Consuming slices do not add custom `transition-*` classes to reimplement motion the primitive already provides.
- Do not animate color-only changes for semantic state transitions (error → success). A color change is state feedback, not a motion moment; let the color token shift happen through the standard hover duration.
- Loading indicators and skeleton shimmer use their own continuous animations and do not need to match the micro-interaction scale.

## Z-Index and Stacking Context

The app uses a layered z-index model with a small set of semantic levels. Arbitrary `z-50`, `z-[999]`, `z-[9999]` values are a sign that layering is not being reasoned about as a system.

- Use a semantic layer scale with a small, named set of levels. Canonical order, low to high: base content (0) → sticky chrome (10) → overlay scrims (20) → dropdowns and popovers (30) → modal dialogs (40) → toasts and notifications (50) → tooltips (60). Define these levels as tokens or a shared constant rather than hardcoding integers inside each component.
- Do not introduce ad hoc `z-[99]`, `z-[999]`, `z-[9999]` values to "win" a stacking battle. Winning with a bigger number means two components are competing in the same layer — fix the layer assignment, not the number.
- Stacking-context ownership belongs in the `shared/ui` primitive that creates the floating surface (dropdown, popover, modal, tooltip). Consuming slices do not set z-index directly on these surfaces.
- Floating surfaces render through a portal (to body or a dedicated portal root) so stacking context is predictable — do not rely on DOM order alone.
- Tooltips sit above modals; a tooltip triggered from inside a modal must still render above the modal's surface. Toasts appear above most chrome but below modals in the active-interaction layer and must not block modal interaction.
- Sticky elements inside scrollable regions use the `sticky chrome` level, not overlay or dropdown. A sticky table header and a dropdown menu are not in the same visual layer.

## Data Density and Table Patterns

Workflow tooling shows a lot of tabular and list-based data. These patterns stay readable without becoming cramped.

- Default row height is comfortable, not compact: `h-10` (40px) or `h-12` (48px). Reserve `h-8` (32px) compact rows for explicitly opted-in dense views. Compact as the default is a defect.
- Cell padding is consistent across a table. Use `px-3 py-2` or `px-4 py-3` as the standard cell-padding steps, chosen once per table and applied uniformly.
- Header rows distinguish through typography and a subtle background: `font-medium`, `text-muted-foreground`, `--color-muted`-backed background. Do not use strong brand colors or heavy shadow to mark the header. Use a single `border-b` with the shared border token under the header; do not double up with extra heavy dividers.
- Row borders use `border-b` with the subtle border token between rows. Do not use full-row outlines — rows are separated by horizontal dividers or spacing, not by boxing each row.
- Row hover uses the `muted` or variant-specific muted family. Do not use strong primary or brand colors for row hover or header backgrounds — they overwhelm the data.
- Row selection state goes through the primitive's selection API using `variant="success"`-equivalent tokens, matching the picker-selection rule. Do not hand-roll selected rows with raw token stacks.
- Cell text truncation uses `truncate` with a `title` attribute exposing the full value. Do not let text wrap to multi-line in table cells by default — wrapping breaks row rhythm.
- Sort indicators are icons, not color. Use directional arrows (`ChevronUp`, `ChevronDown`) sized to match header text. Do not indicate sort direction through color hue alone.
- Column alignment follows data type: numbers, currency, and timestamps align right; text aligns left; status badges and icons align center. Mixed alignment within a column is a defect.
- Empty table states use the passive muted family — an empty table reads softer than populated rows, not louder.
- Pagination, load-more, and virtualization controls live in the table primitive's footer slot. Do not let each consuming module reimplement pagination with its own spacing and typography.
- Sticky table headers use the `sticky chrome` z-index layer. Do not give a sticky header an arbitrary z-index value.
- Action columns (row-level edit, delete, menu triggers) align right and use icon-only buttons with `aria-label`, following the Icon System rules.

## Drag and Drop Visual Feedback

The canvas is a drag-heavy surface: nodes are placed, edges are wired, palette items are dropped onto the canvas, and panels accept rearrangement. Drag feedback is part of the visual system and its language stays consistent across React Flow and non-canvas drag interactions.

- Dragged elements expose a clear drag ghost: the dragged element at reduced opacity (canonical `opacity-60`) with original border and background tokens preserved. Do not replace the ghost with a raw outline, system drag preview, or decorative silhouette.
- Drag origin elements visually acknowledge being the source (e.g. lowered opacity while drag is active) so the user can tell where the drag started even if the ghost is under the cursor.
- Valid drop targets highlight with the `primary` family's border and muted surface tokens (`border-primary-border-hover`, `bg-primary-muted`). Invalid drop targets use the `destructive` family's border token and a subtle `destructive-muted` surface. Do not signal invalid drop with raw palette red outlines, and do not use raw palette colors for any drag feedback.
- Only highlight drop targets that are actually valid for the current payload. A drag that cannot be dropped anywhere should not light up every droppable region — silence is a valid response.
- Cursor feedback is mandatory: `cursor-grab` for draggable handles at rest, `cursor-grabbing` while dragging, `cursor-not-allowed` when hovering an invalid target. Do not leave pointer cursor on a mid-drag surface.
- Snap indicators (alignment guides, grid snap lines, edge-to-port alignment hints) use the `primary` family's `-icon` or `-border` tokens for their visible stroke.
- Canvas-specific drop feedback lives in the canvas interaction module, but the underlying token choices for ready/invalid/snap states come from the shared token system. The canvas does not invent its own drag palette.
- Drop animations (node settle, edge confirmation) use the Motion scale (`duration-150` to `duration-200`, `ease-out`). Do not use bounce or overshoot easing on drop confirmation.
- Autoscroll behavior at canvas or list edges during drag lives in the drag primitive or a shared drag wrapper, not per consumer.

## Split Pane and Resizable Panel Patterns

The primary layout combines canvas, code editor, and sidebar panels that can be resized and collapsed. Split-pane mechanics behave predictably, persist state, and expose resize affordances without becoming visual noise.

- Resize handles are visible at rest — a 1px semantic border as resting state, intensifying on hover (`border-border` → `border-primary-border-hover`). Do not hide handles behind hover-only visibility in a resize-heavy layout.
- Resize handle hit area is larger than its visible width: visible handle may be 1px, but the pointer-active region is at least 4–6px wide.
- Resize handle cursor follows direction: `cursor-col-resize` on horizontal splitters, `cursor-row-resize` on vertical splitters. Do not leave pointer cursor on a splitter.
- Every resizable panel has explicit min/max sizes defined in the panel primitive. Minimums prevent the panel from disappearing when dragged to zero; maximums prevent one panel from starving siblings. These limits live in the shared panel primitive, not in consuming layout code.
- Collapse and expand are distinct from resize. A collapsed panel is hidden or reduced to a chrome-only strip, not a zero-width resized panel. Collapse is reversible through a visible, discoverable affordance (collapse button in panel chrome, or a rail-style re-expand trigger when collapsed).
- Collapse/expand transitions follow the Motion scale (`duration-200`, `ease-out`). Do not animate panel width continuously during a resize drag — resize is direct manipulation, not a transition.
- Panel sizes persist across sessions for panels that participate in the user's workspace layout. Persistence lives in the panel primitive or a shared layout controller, not in each consuming module. Persisted sizes are clamped to the current min/max on restore.
- While dragging a splitter, overlay a subtle active-state highlight on the handle (`bg-primary-border-hover` or equivalent). Do not animate the handle itself during drag; only reinforce its active state.
- The splitter must not overlap interactive controls in adjacent panels. The hit area belongs unambiguously to the splitter when the pointer is within it.
- Splitters support keyboard resize. Arrow keys adjust size in standard increments (e.g. 16px per step, larger jumps with modifier keys). Splitters are focusable interactive controls with a visible focus ring.
- The split-pane primitive owns its own z-index context so splitter handles do not compete with floating surfaces (dropdowns, tooltips).

## Badge and Status Indicator System

Workflow definitions carry many states — draft, published, active, paused, error, running, completed. The badge and status language stays consistent so the same visual read always means the same thing. This section applies equally to **`TagEditor`** chips and any pill-shaped control that carries **classification or state**: they must use **semantic coloring** (`success`, `info`, `warning`, `destructive`, or neutral `muted` / `default`) — not `secondary` / `tertiary` — when color is meant to be interpreted as meaning.

- Badges have two canonical forms: the dot indicator (`size-2` colored dot, used when the label is already provided by adjacent text) and the pill badge (rounded rectangular with its own label, used when status must stand alone). Never use a bare dot to communicate state when the adjacent context does not name the state — upgrade to a pill badge with a label.
- Status colors map to shared semantic token families:
  - `draft` / `inactive` / `idle` → `muted` family
  - `active` / `running` / `in-progress` → `default` or `primary` family
  - `success` / `completed` / `published` → `success` family
  - `warning` / `paused` / `pending` → `warning` family
  - `error` / `failed` → `destructive` family
  - Informational-only labels (non-success, non-warning, non-error) → **`info`** when a distinct informational hue is required; otherwise **`muted`** or **`default`**
- Do not introduce a new status with a one-off color; extend the token system first.
- Pill badges use `text-xs` with `font-medium`, `px-2 py-0.5` internal spacing, and the matching variant's `-muted` background with `-text` foreground — the same contract the Button primitive uses for muted-surface variants.
- Count badges (notifications, unread counts) live at the edge of their anchor (top-right by default) with `size-4` or `size-5`, `text-xs` `font-medium`. Cap values beyond a two-digit threshold visually (e.g. `99+`) so the badge does not distort its anchor's layout.
- Live/animated status indicators (e.g. a pulsing dot on an active workflow) use a continuous opacity animation that respects `prefers-reduced-motion`, and do not animate size or position.
- Status badges are read by assistive tech: the badge text or an `aria-label` on the dot indicator must communicate the state — a dot without a label is invisible to screen readers.
- Badge rendering is owned by a shared `Badge` (pill) and `StatusDot` primitive. Consuming modules choose the variant; they do not reimplement pill shape, dot size, or state-to-token mapping.

## Form Design Patterns

The app hosts many form surfaces — workflow metadata, node configuration, task/function/extension/schema/view editors. A consistent form language is a usability baseline.

- Default label placement is top-aligned above the control. Top labels work across all field widths, respond well to long label text, and match the corporate tone. Use inline labels only for compact toolbar-style filters, not for editor forms.
- Labels use `text-sm` `font-medium` with `text-foreground`. Helper text sits directly below the control in `text-xs` with `text-muted-foreground`. Error text replaces helper text (does not stack with it) and uses `text-xs` with `text-destructive-text`.
- Required fields are marked through a visible indicator next to the label (asterisk in the destructive text token, or a small "(required)" suffix). If the form is mostly required, explicitly mark optional fields instead — pick one convention per form and stay consistent.
- Validation timing: validate on blur for field-level feedback, validate on submit for form-level feedback, and never validate on the first keystroke. Once a field has shown an error, it may re-validate on change so the user sees the error clear as they fix it — this is the only time per-keystroke validation is acceptable.
- Error messages are field-adjacent and name the specific problem, not generic "this field is invalid." The shared `Input` primitive's `aria-invalid` and error message slot own this rendering. Use `shared/ui/Input` instead of raw `<input>` in module and page code — pass `inputClassName` for font or sizing overrides. Reaching past the primitive with `px-2 py-1 text-xs border border-border rounded bg-background font-mono` recreates primitive responsibility in consumer code.
- Form-level errors (server-side failures, cross-field validation) appear at the top of the form in an alert surface using the `destructive` family's muted background and text tokens. Do not use a full destructive background for form-level alerts — that emphasis is reserved for critical destructive confirmations.
- Field grouping uses spacing as the primary separator: `space-y-4` or `space-y-6` within a group, larger gap (`space-y-8`) plus a section heading between groups. Use explicit section headings rather than horizontal rules to divide groups.
- Related fields (date range, min/max pair, first/last name) sit on the same row using `grid` or `flex` with a consistent gap token; the relationship must be visible at a glance.
- **Nested card / “metadata band” layout:** Inside a **`tertiary`** (or **`secondary`**) sub-card, structure **vertical bands** with **`space-y-4`**: first a **full-width single-line** primary field (e.g. title or description via **`Input`**), then a **`grid`** band (`grid-cols-1` `sm:grid-cols-2` `gap-4`) for **paired short fields** (e.g. maintainer + license), then heavier controls (tags, textareas) **below**. Avoid one flat multi-column grid that forces the primary long label field to share a row with unrelated peers.
- **Boolean clusters in sub-panels:** Several related **boolean** fields inside a nested **`Card`** (e.g. schema rule toggles) should use **`grid-cols-1 sm:grid-cols-2` `gap-4`** so pairs read **side-by-side** from `sm` breakpoint upward and **stack** on narrow viewports.
- Input width reflects expected input length. Use the Tailwind size scale (`w-20`, `w-32`, `w-full` in a grid column) rather than ad hoc arbitrary widths.
- Submit and cancel actions live at the end of the form: right-aligned in modal/dialog forms, left-aligned or full-width in full-page forms. Destructive confirmations (`Delete`, `Discard changes`) sit furthest from the primary action to reduce mis-clicks.
- Submit is `variant="default"` (primary action). Cancel/back is `variant="secondary"` or `variant="default"`, not `destructive`. Delete-and-save-style forms expose a destructive action as a tertiary placement, not as the submit button.
- Disabled submit state must be reachable with an accessible explanation (tooltip or adjacent helper text) of what is missing. Do not silently disable submit.
- Form state (submitting, saving, error) is communicated through the submit button's loading state and a persistent form-level status region, not toast-only feedback that disappears.
- All form composition rules live in a shared form layout primitive or a small set of shared form building blocks. Modules compose the building blocks; they do not reimplement label placement, error rendering, or validation timing.

### Line-delimited `string[]` fields (Textarea vs TagEditor)

- **Textarea (line model):** Prefer **`Textarea`** with **one logical value per line** (optional **`font-mono` `text-sm`** for keys, **`resize-y`**, concise helper copy) for **bulk technical lists**: hostnames, exported component keys, allowlists, and any field where users **paste** or **type** many homogeneous entries. Full-width bands (`sm:col-span-2` inside a parent grid) work well so lines are not squeezed into half-width columns.
- **TagEditor (chip model):** Prefer **`TagEditor`** for **short, chip-oriented** sets (e.g. **keywords**, small curated lists) where pill add/remove is the primary affordance — not as the default for every `string[]` in a config surface when the line model is clearer.
- **Enter / newlines must not disappear:** When syncing **`Textarea`** text ↔ `string[]`, **do not** `filter` out every empty line **on each `onChange`** and immediately write back a joined string — that removes the newline the user just typed and **Enter feels broken**. Split on `\n`, **trim per line** for content, but **preserve blank lines while editing** (keep `""` in the array), **or** hold a **local draft string** and commit parsed arrays on **blur**. **Normalize** (drop empty / whitespace-only entries) on **submit** (and optionally on blur) so persisted JSON stays clean.
- **Dense modals:** In **tall scrollable dialogs** with many line-list fields, use a **modestly small** initial **`rows` / `min-h-*`** so the form stays scannable; keep **`resize-y`** so users can expand one field when needed. Prefer one shared helper or defaults in a primitive over unrelated magic numbers per screen.

## Notification and Toast Visual System

Transient notifications (toasts, banners) sit at the intersection of the token system, the Motion scale, and the Z-Index layer scale. Ownership, state, and the rendering pipeline are defined separately in the `notification-feedback-web` skill — this section only covers the visual contract: semantic variants, positioning, stacking rhythm, motion, dismissal. The two skills must stay aligned.

- Toast rendering goes through the shared `@shared/ui/sonner` wrapper. Do not introduce a parallel toast surface or mount a custom raw `sonner` toaster to customize appearance — visual rules here apply to the shared wrapper.
- Toast variants map to the same semantic token families used elsewhere (`success`, `destructive`, `warning`, `default`/`muted`). Do not invent a fifth or sixth toast color. Each variant uses the `-muted` surface with `-text` foreground and `-border` border — do not use full-saturation variant surfaces, they dominate the viewport.
- Toast icons follow the Icon System: the variant's `-icon` token on the leading side, `size-4` paired to `text-sm` body text, consistent stroke width.
- Canonical position is bottom-right on desktop, bottom-center on narrow viewports. Position is owned by the shared toaster mount — do not let consumers override position per call.
- Stacking: new toasts enter at the base and push older toasts upward, with a consistent gap (`gap-2` or `gap-3`) between items. Cap visible toasts at 3–5; overflow collapses into a "+N more" affordance or silently queues. The visible stack must not grow unbounded.
- Auto-dismiss durations map to semantic urgency: `success`/neutral info → ~4s, `warning` → ~6s, `destructive` errors → do not auto-dismiss by default, or 8–10s with an explicit dismiss control. Destructive toasts carrying actionable information (retry, open log, view details) remain until dismissed or acted upon — auto-dismissing an unread error is a usability defect.
- Every toast exposes a visible dismiss affordance: an icon-only close button following the Icon System (`aria-label="Dismiss"`, `size-8` hit area, muted icon at rest). Do not rely on auto-dismiss alone.
- Toast action buttons use the shared `Button` primitive with `variant="secondary"` or `variant="tertiary"` at compact size. Do not use `variant="default"` inside a toast — the toast surface is already the container of attention, and a primary-weight button competes with it. Only one primary action per toast; multi-action interactions belong in an inline panel or modal.
- Hover on a toast pauses its auto-dismiss timer — this depends on the surface keeping a stable interactive region, another reason surfaces stay at `-muted` saturation with a clear border.
- Toast enter/exit uses the Motion scale (`duration-200` `ease-out` for entry, `duration-200` `ease-in` for exit, typically fade + slight translate from the stacking direction). Do not use bounce, spring, or elastic easing. When `prefers-reduced-motion` is active, enter/exit collapses to opacity-only cross-fades with no translate.
- Toasts live at the `toasts and notifications` z-index layer (canonical 50). Tooltips sit above; modals sit above toasts in the active-interaction layer. Do not raise toasts above modals by bumping z-index. Toasts must not intercept pointer events over an open modal — pointer-events stay active on the toast itself but fall through the surrounding gap.
- Banners are distinct from toasts: persistent page-level feedback, not time-boxed, not auto-dismissed, inline in the page layout rather than a floating stack. Banner surface tokens match the toast variant mapping, but banners use `text-sm` body text in a full-width surface with a subtle border. Do not use a floating toast for persistent page-level feedback.
- Inline form errors (see *Form Design Patterns*) and inline screen errors are preferred over toasts when the failure belongs to the current screen. Toasts are for cross-screen outcomes, not a replacement for proper screen states — this mirrors the rule in `notification-feedback-web`.

## Ownership Boundary

- These variant and token rules are primarily for `apps/web/src/shared/ui` and other library-like reusable primitive layers.
- `modules` and `pages` may choose which variant to use but do not become the home of per-variant implementation logic. A consuming slice composes primitives and picks semantics (`variant="secondary"`, `hoverable={false}`) but does not define what `secondary` means in raw Tailwind terms.
- If multiple consuming modules need the same visual behavior, move it into the primitive or a shared wrapper under `shared`, not into repeated module-level class strings.
- Do not shift routine page chrome to `secondary`, `tertiary`, or other families when `default` should remain the baseline theme. Do not let modules encode page-level outer spacing that should belong to pages.

## Review Standard

Flag the implementation if any of the following occur. Each item below maps back to the section that owns its rule — use this as a reviewer's lens, not a replacement for the sections above.

Scope and token system:

- A structural refactor silently turns into a broad visual redesign, or theme changes are introduced without a clear shared benefit.
- Reusable color work bypasses `apps/web/src/index.css`, or new tokens are added there without nearby comments describing their broad intended usage.
- Raw Tailwind palette colors (`bg-slate-100`, `text-red-500`, `text-zinc-400`, etc.) are used as app-level color decisions instead of semantic token-backed utilities.
- A token is chosen because its resolved hex value visually matches rather than because its semantic role matches.
- A structural token slot (`-border`, `-icon`, `-muted`) is used in a role it was not designed for (e.g. `-border` as text color, `-icon` as gradient stop).
- Token names are scoped to one feature, page, or action instead of a stable cross-app semantic role.
- New theme work bypasses Tailwind without an explicit compatibility reason, or token work adds more local exceptions than it removes.

Primitives and variants:

- A reusable primitive is extended with ad hoc custom classes when the need is covered by a stable variant or primitive-owned boolean (`hoverable`, `noBorder`).
- Consuming slices reimplement primitive variant meanings instead of using the shared variant API.
- A selected-state picker uses raw token classes (`bg-primary-muted`, `border-primary-border-hover`) instead of `variant="success"` on the `Button` primitive.
- Variant families exist in `index.css` but the primitive bypasses them with hard-coded Tailwind palette values.
- Raw `<input>` is used in module or page code when `shared/ui/Input` exists, or titled sectioned editor panels are structured as plain divs with `border-t` dividers instead of the `Card/CardHeader/CardContent` pattern.
- General app UI defaults to non-`default` variants without an explicit semantic reason.
- **`DialogContent`** (or equivalent modal shell) is not **`variant="default"`** without an explicit product decision, or **section cards** skip **`secondary`** and use **`tertiary`** as the first inset on a default shell (*Structural nesting vs semantic state* → *Dialog / panel outer shell*).
- **`Input`**, **`Textarea`**, **`Select`**, **`TagEditor`**, or similar **field** primitives use **`secondary`/`tertiary`** only to “match” a nested **`Card`**, instead of staying **`variant="default"`** for normal editing (exceptions: **`muted`** read-only / low-emphasis, **`destructive`** / errors, deliberate **`info`** callout surfaces) (*Structural nesting vs semantic state* → *Field primitives inside structural cards*).
- `secondary` / `tertiary` surfaces (or control variants) are used to imply success, failure, caution, or informational meaning where **`success`**, **`info`**, **`warning`**, or **`destructive`** is the correct family (*Structural nesting vs semantic state*, *Semantic coloring (chromatic families)*).
- **`Badge`**, **`TagEditor`**, or similar chips use `secondary` / `tertiary` (or arbitrary palette classes) to carry **state or validation meaning** that should use **`success`**, **`info`**, **`warning`**, or **`destructive`** instead (*Semantic coloring (chromatic families)*).

Interaction, hover, cursor, destructive:

- Clickable bordered surfaces use non-semantic or non-primary border colors without a semantic exception.
- Hover disabling is partial — internal hover-linked visuals still change when the primitive claims hover is off.
- Interactive controls lack pointer-style cursor feedback, or disabled controls still present pointer cursor affordance.
- Interactive affordances are not visually separable from their background until hover occurs.
- Destructive tokens are used for `cancel`, `close`, `dismiss`, or similar non-destructive actions.
- Passive empty-state or no-data regions share visual weight with primary interactive controls instead of using the muted family.

Typography, icons, focus:

- `text-xs` is used as primary content or label text instead of metadata, or arbitrary font-size values (`text-[13px]`) bypass the standard scale.
- Color is the sole differentiator between two hierarchy levels without a supporting typographic cue, or raw palette text utilities appear where semantic foreground tokens exist.
- Focus rings are removed or suppressed on interactive controls.
- Icon sizes are not paired to adjacent text sizes through the shared scale, or arbitrary icon sizes are used.
- Icon-only controls lack `aria-label` or fall below the `size-8` hit area; icons mix inconsistent stroke widths within the same surface; emoji or image glyphs replace the icon system.

Elevation, spacing, motion, z-index:

- Shadows heavier than `shadow-sm` are used for cards, panels, or sidebar separation, or shadows are applied to buttons and interactive controls for depth.
- Decorative gradients or pattern textures appear on UI surfaces without a functional purpose.
- Repeated spacing patterns are copied across modules and pages instead of being centralized, or modules define outer layout spacing that belongs to pages, or arbitrary spacing values (`text-xs`, `p-2`) tighten panels without a design reason.
- Elastic, spring, bounce, or back easing curves appear in the UI; transition durations fall outside the standard scale; layout-affecting properties are animated without performance justification; `prefers-reduced-motion` is not honored; consumer `transition-*` classes duplicate primitive-owned motion.
- Arbitrary z-index values (`z-[99]`, `z-[999]`, `z-[9999]`) resolve stacking conflicts instead of fixing layer assignment; floating surfaces render without a portal; z-index is set on primitive-owned floating surfaces from consuming slices.

Data, drag, split-pane, badge, form, notification:

- Compact row heights are the default; table text wraps by default instead of `truncate` + `title`; sort direction is communicated through color alone; strong primary or brand colors are used for row hover or header backgrounds; selected-row styling is hand-rolled instead of going through the primitive.
- Drag ghosts are raw outlines or decorative silhouettes; every droppable region lights up during a drag; invalid drop uses raw palette red outlines; drag cursors fall back to pointer; snap indicators use raw palette colors.
- Resize handles are invisible at rest or lack a wider pointer-active hit area; splitters leave pointer cursor; collapse is implemented as a zero-width resize; panel width animates during drag; resizable panels lack explicit min/max bounds or do not persist sizes.
- A new status semantic uses a one-off color instead of a token family; a bare dot is used where adjacent context does not name the state; count badges grow without a visual cap; status dots lack `aria-label` or accompanying text; pill shape or state-to-token mapping is reimplemented outside the badge primitive.
- Form labels are inline beside controls in editor forms; fields validate on first keystroke; error messages are generic; form-level alerts use full destructive backgrounds; horizontal rules divide form sections where spacing + headings should; cancel or back actions use `variant="destructive"`; the submit button is silently disabled; success/failure is communicated only through a transient toast.
- **Line-delimited** `Textarea` ↔ `string[]` mapping **drops all empty lines on every keystroke**, so **Enter appears broken** (*Line-delimited string[] fields*).
- **`TagEditor`** is used for **long homogeneous bulk lists** where a **line-per-row `Textarea`** is the clearer model, or the inverse: **Textarea lines** for **keyword-style chip** metadata without justification (*Line-delimited string[] fields*, *Semantic coloring* for chip semantics).
- **Wide dialog** places logically **dependent section cards in separate columns** without reading-flow reason (*Wide dialog / two-column layout*).
- **Metadata-style** sub-card: primary **single-line** field forced into a **shared multi-column grid** with unrelated peers instead of **full-width row + paired `sm:grid-cols-2` band** (*Nested card / “metadata band” layout*).
- **Boolean** groups in a sub-panel stay **single-column** on `sm+` where **two columns** would match the established toggle grid (*Boolean clusters in sub-panels*).
- A custom `sonner` toaster or parallel toast surface is mounted outside `@shared/ui/sonner`; toast surfaces use full-saturation variant backgrounds; toast variant color falls outside shared semantic families; consumers override toast position per call; the visible stack grows unbounded; destructive error toasts auto-dismiss before being read or acted on; toasts lack a visible dismiss affordance; toast action buttons use `variant="default"` or stack multiple primary actions; toast motion uses bounce/spring/elastic easing; toasts are raised above modals by bumping z-index or intercept pointer events over an open modal; persistent page-level feedback is rendered as a floating toast rather than an inline banner.
