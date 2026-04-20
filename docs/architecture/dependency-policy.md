# Dependency policy

## Package roles

| Package / app | Role |
|---------------|------|
| `@vnext-forge/app-contracts` | Pure types, Zod schemas, `ERROR_CODES`, `VnextForgeError`, shared env parsers (`env/common.ts`). **No** imports from other workspace packages. |
| `@vnext-forge/services-core` | RPC method registry, dispatch, services. Imports **`app-contracts` only** — **no** env parsing. |
| `@vnext-forge/lsp-core` | LSP shared code; consumed by **`apps/extension`** and **`apps/server`** where applicable. |
| `@vnext-forge/designer-ui` | React UI, hooks, host ports/adapters. Imports **`app-contracts`**; **no** server secrets. |
| `apps/server`, `apps/web`, `apps/extension` | **Composition roots**: each owns a single validated **config** module; wires transports, providers, and shell-specific adapters. |

## Allowed import directions

```mermaid
flowchart BT
  subgraph apps["apps/* composition roots"]
    WEB[apps/web]
    EXT[apps/extension]
    SRV[apps/server]
  end
  DU[designer-ui]
  SC[services-core]
  AC[app-contracts]
  LSP[lsp-core]

  WEB --> DU
  WEB --> AC
  EXT --> DU
  EXT --> AC
  EXT --> LSP
  SRV --> SC
  SRV --> AC
  SRV --> LSP
  DU --> AC
  SC --> AC
```

## Forbidden (non-exhaustive)

| From | To | Why |
|------|-----|-----|
| `apps/web` | `services-core` | Bypasses RPC/transport boundary; duplicates capability and transport concerns. |
| `apps/web` | `apps/extension` / `apps/server` | Wrong tier; creates circular product coupling. |
| `designer-ui` | `apps/*` | Library must not depend on a composition root. |
| `app-contracts` | any workspace package | Contracts stay the innermost layer. |
| Any module | `process.env` / `import.meta.env` **outside** that app's `shared/config/config` (or documented equivalent) | Env is validated once per shell. |

## Lint and tooling enforcement

| Rule / script | Enforces | Notes |
|---------------|----------|--------|
| `apps/web` ESLint `no-restricted-imports` | **Ban** `@vnext-forge/services-core` and deep paths into `packages/services-core` (**R-a6**) | See `apps/web/eslint.config.js`. |
| `apps/web` ESLint patterns | Ban imports from `@vnext-forge/designer-ui/dist/**` | Prevents compiled-path leakage. |
| `pnpm check:exports` → `scripts/check-exports.mjs` (**R-a1**) | Every `package.json` `exports` / `main` / `types` target exists on disk | Root script; runs in CI. |
| `packages/designer-ui` ESLint | Standard workspace rules. **Gap:** no graph rule forbidding `designer-ui → apps/*` — convention + review. |
| `apps/extension` | Uses root/shared lint patterns. **Gap:** mirror `apps/web` ban if `services-core` ever appears as a dependency. |

**Convention-only gaps:** `services-core → designer-ui`, `lsp-core → apps/*`, and most cross-app edges — rely on **review** and **TypeScript project references**, not a single graph rule.

## Config and secrets

- Only **composition-root config modules** read environment variables.
- Shared parsers: `@vnext-forge/app-contracts/env/common.ts` (`LogLevelSchema`, `NodeEnvSchema`, `coercedBool`, `csvList`, `isLoopbackHost`, …).
- See [ADR 001 — Trust model](./adr/001-trust-model.md) for the runtime defaults that depend on this single-config-reader rule.
