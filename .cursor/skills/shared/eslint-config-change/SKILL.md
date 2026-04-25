---
name: eslint-config-change
description: Scope is the entire monorepo (root + all workspaces under apps/* and packages/*). Update the monorepo ESLint configuration in vnext-forge. Use when changing shared lint rules, workspace-specific ESLint behavior, runtime globals, or logger/no-console overrides. Trigger this skill for any ESLint config work in `eslint.config.mjs` at the repo root or in any workspace.
---

# ESLint Config Change

> **Scope:** Repo-wide (root `eslint.config.mjs` plus per-workspace ESLint files under `apps/*` and `packages/*`).

Use this skill when editing the ESLint setup in this repository.

## Architecture

- Keep the root [`eslint.config.mjs`](../../../eslint.config.mjs) as the shared monorepo factory only.
- Do not turn the root config into a real lint target. The default export should stay minimal and ignore the root by default.
- Use `createWorkspaceConfig(...)` from the root config in each workspace-level ESLint file.
- Put workspace-specific plugins, overrides, and file globs in the workspace config, not in the root shared factory, unless the rule truly applies everywhere.

## Runtime Model

- Set `runtime: 'browser'` for frontend apps.
- Set `runtime: 'node'` for backend/server apps.
- Set `runtime: 'library'` for packages that should not receive implicit browser or node globals.
- Do not force `globals.browser` or `globals.node` onto library packages unless there is an explicit runtime requirement.

## Console And Logger Policy

- Keep `no-console` enabled as `error` in the shared rule set.
- Do not disable `no-console` globally or per workspace.
- Allow `console.*` only in the single central logger implementation file for that workspace.
- When a logger file is added, update only that workspace's `loggerConsoleFiles` list with the exact relative path.
- Preserve the `TODO(logger)` comments in the shared config and workspace configs. Do not delete or weaken them before a real central logger exists.

## Monorepo Guardrails

- Avoid root-level file globs such as `src/**/*` inside the shared config. Those patterns are wrong for a monorepo root.
- Keep workspace globs relative to the workspace config file that owns them.
- Prefer shared rules in the root factory and package/app-specific behavior in workspace configs under `apps/*` and `packages/*`.

## Validation

- After changing ESLint config, validate the affected workspace with `pnpm exec eslint --print-config <file>`.
- Validate from inside the target workspace so `tsconfigRootDir` and runtime globals resolve correctly.
- If a logger override was added, confirm that `no-console` is still `error` outside the logger file and `off` only for the listed logger path.
