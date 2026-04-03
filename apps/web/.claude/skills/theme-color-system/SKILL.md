---
name: theme-color-system-web
description: Optional guidance for theming and color tokens in the web app. Use only when the task is explicitly about visual system work; do not treat theme token migration as a required part of the architecture refactor.
---

# Theme Color System Web

## Purpose

Use this skill when a task is explicitly about visual system cleanup, theming, or tokenization.

This skill is optional. It is not a blocking rule for the structural architecture refactor.

## Repo Rules

- Do not force a full token or dark-mode migration as part of unrelated architecture work.
- Preserve the existing visual language unless the task scope includes design-system changes.
- When theme work is in scope, prefer semantic tokens over uncontrolled per-component palette sprawl.

## Do

- Centralize reusable visual decisions when a design-system task is active.
- Prefer semantic naming for broadly reused colors.
- Keep shared tokens in global styling infrastructure, not scattered across feature files.
- Introduce token work incrementally when it clearly reduces duplication.

## Do Not Do

- Do not block architecture changes on a full theme rewrite.
- Do not mix a new token system with many one-off local color exceptions.
- Do not push page-specific color rules into shared styling primitives without reuse.

## Review Standard

Flag the implementation if:

- a structural refactor silently turns into a broad visual redesign
- theme changes are introduced without a clear shared benefit
- token work adds more local exceptions than it removes
