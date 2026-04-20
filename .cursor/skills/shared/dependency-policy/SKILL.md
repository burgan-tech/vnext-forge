---
name: dependency-policy
description: Scope is repo-wide. Enforces the cross-package import direction policy (apps depend on packages; packages depend only on packages of equal or lower role; apps never depend on each other). Trigger this skill when adding a new import that crosses workspace boundaries, modifying `package.json` `dependencies`, adding/changing barrel files, or editing ESLint `no-restricted-imports`. See `docs/architecture/dependency-policy.md`.
---

# Dependency Policy

> **Scope:** Repo-wide. Authoritative document: [`docs/architecture/dependency-policy.md`](../../../../docs/architecture/dependency-policy.md).

## Allowed graph (only these directions)

```text
vnext-types
  └─> app-contracts
        ├─> services-core ─> apps/server, apps/extension
        ├─> lsp-core      ─> apps/server, apps/extension
        ├─> designer-ui   ─> apps/web,    apps/extension/webview-ui
        └─> apps/*
```

## Forbidden combinations (must)

- `apps/web` **must not** import `@vnext-forge/services-core` or any deep path under `packages/services-core/**`. Reason: the server-only RPC implementation should never ship to the browser. Enforced by `apps/web/eslint.config.js` `no-restricted-imports`.
- `apps/web` **must not** import from `@vnext-forge/designer-ui/dist/**`. Always use `@vnext-forge/designer-ui` or its declared subpaths (e.g. `@vnext-forge/designer-ui/editor`). Enforced by ESLint.
- `apps/*` **must not** import each other. Cross-app sharing happens through `packages/*`.
- `packages/*` **must not** import `apps/*`. Packages are leaves of the build graph.
- `packages/app-contracts` and `packages/vnext-types` are **pure types/schemas** — no runtime side effects, no environment reads, no I/O.

## Adding a new dependency edge

1. Verify the edge is in the allowed graph (use the diagram in `docs/architecture/dependency-policy.md`).
2. Update the consumer's `package.json` `dependencies` (workspace protocol `workspace:*`).
3. If introducing a new public subpath in `packages/*`, follow [`docs/architecture/bundler-checklist.md`](../../../../docs/architecture/bundler-checklist.md).
4. If the edge requires a new ESLint exception, document the exception inline in `eslint.config.js`.

## Quick checks

- Direct `process.env` / `import.meta.env` reads outside the per-app `shared/config/` module are a smell — see the `config-singleton` rule.
- Re-exports through deep paths (`/dist/**`, `/src/**`) bypass the `package.json#exports` map; treat as bugs.

## Cross-references

- [`docs/architecture/dependency-policy.md`](../../../../docs/architecture/dependency-policy.md)
- [`docs/architecture/bundler-checklist.md`](../../../../docs/architecture/bundler-checklist.md)
- `apps/web/eslint.config.js` — concrete `no-restricted-imports` enforcement.
