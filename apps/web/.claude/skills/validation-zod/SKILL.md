---
name: validation-zod-web
description: Use when defining validation in the web app. Use React Hook Form and Zod for form UX, keep runtime validation at package or API boundaries, and do not duplicate durable schemas inside UI slices.
---

# Validation Zod Web

## Purpose

Use this skill to separate form validation from runtime contract validation while keeping both aligned with the repo architecture.

## Repo Rules

- Use `React Hook Form` and `Zod` for form-facing validation in web.
- Keep form schemas outside presentation components.
- Keep durable contract schemas in shared packages when they belong to domain or workflow rules.
- Re-validate external or transformed data at API and package boundaries.
- Normalize runtime validation failures into the shared error model.

## Ownership

- Web form layer owns field-level UX, correction flow, and submit readiness.
- Shared packages own durable workflow, contract, and domain schemas.
- API or adapter boundaries own response and payload trust checks.

## Do

- Define form schemas near the form model in the owning FSD slice.
- Reuse package schemas or schema parts when they represent real shared contracts.
- Validate transformed payloads before sending them.
- Validate external data before trusting it in entities or features.
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
- If it is about runtime trust or cross-app contracts, move it to the package or boundary that owns the contract.

## Review Standard

Flag the implementation if:

- form schemas are buried inside components
- package-level rules are copied into multiple screens
- external data is trusted without runtime validation
- validation failures bypass the shared error contract
