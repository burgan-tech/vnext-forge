---
name: validation-zod-web
description: Scope is apps/web (web frontend). Use when defining validation in the web app. Use React Hook Form and Zod for form UX, keep runtime validation at package or API boundaries, and do not duplicate durable schemas inside UI slices. Trigger this skill for any form/zod validation work under `apps/web`.
---

# Validation Zod Web

> **Scope:** `apps/web` (web frontend). This skill applies only to code under `apps/web`.

## Purpose

Use this skill to separate form validation from runtime contract validation while keeping both aligned with the repo architecture.

## Repo Rules

- Use `React Hook Form` and `Zod` for form-facing validation in web.
- Keep form schemas outside presentation components.
- Keep durable contract schemas in the boundary that actually owns them: the remaining shared packages for cross-app contracts, app-local validation modules for web-only rules, or server slices for backend-only rules.
- Re-validate external or transformed data at API and module boundaries.
- Normalize runtime validation failures into the shared error model.

## Ownership

- Web form layer owns field-level UX, correction flow, and submit readiness.
- `@vnext-forge/app-contracts` and `@vnext-forge/types` own the remaining shared cross-app contracts.
- `apps/web/src/validation/*` and module-local schemas own web-only validation behavior by default.
- `apps/server/src/slices/validate/*` owns server-side validation integration.
- API or adapter boundaries own response and payload trust checks.

## Do

- Define form schemas near the owning module by default.
- Lift a schema into `shared/*` only when that rule is genuinely reused and stays generic across modules.
- Reuse shared package schemas only when they represent real cross-app contracts.
- Reuse app-local schemas when the rule is specific to the web editor or validation UX.
- Validate transformed payloads before sending them.
- Validate external data before trusting it in modules or shared adapters.
- Keep user-facing validation messages separate from technical diagnostics.

## Do Not Do

- Do not define inline schemas inside JSX by default.
- Do not duplicate the same domain contract in multiple web slices.
- Do not assume TypeScript types replace runtime validation.
- Do not leak raw `Zod` internals into UI branching.
- Do not use one giant schema for form UX, transport, persistence, and response parsing at once.

## Decision Rule

Ask one question first:

Is this rule about user correction, or about runtime trust?

- If it is about user correction, keep it in the web form layer.
- If it is about runtime trust or cross-app contracts, move it to the shared package or app boundary that owns the contract.

## Review Standard

Flag the implementation if:

- form schemas are buried inside components
- boundary-owned rules are copied into multiple screens
- external data is trusted without runtime validation
- validation failures bypass the shared error contract
