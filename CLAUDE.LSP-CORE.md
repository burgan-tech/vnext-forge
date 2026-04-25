# lsp-core Instructions

> **Scope:** `packages/lsp-core` (shared LSP plumbing for the OmniSharp/Roslyn-based language host). Consumed by `apps/extension` and `apps/server`.

## Goal

**One factory** owns the LSP installer + bridge + **transport** lifecycle so both shells reuse the same stack shape. Shell-specific code only supplies adapters (VS Code vs WebSocket server).

## Single ownership rule

**`createExtensionHostLspStack(...)`** (`extension-host-lsp-stack.ts`) is the **single entry point** for this stack.

- At most **one process** per machine should own the installer/bridge for a given workspace at a time.
- Multiple webviews **share** one bridge **per shell**; do not spin duplicate installers for each webview.

## Folder layout

```text
packages/lsp-core/src/
  extension-host-lsp-stack.ts   # factory — single public orchestration entry
  …                             # bridge, installer, transport abstractions as implemented
```

## Adapters

- **Extension shell** wires VS Code–hosted pieces (commands, file system, progress).
- **Server shell** wires the WebSocket router under `apps/server`.
- **lsp-core** stays **transport-agnostic**; consumers inject or connect the transport that matches their host.

## WebSocket policy lives in the consuming server

Limits and origin checks are **not** duplicated inside lsp-core for the server path. Enforced in:

- [`apps/server/src/lsp/router.ts`](./apps/server/src/lsp/router.ts)
- [`apps/server/src/lsp/lsp-ws-policy.ts`](./apps/server/src/lsp/lsp-ws-policy.ts)

Includes **max message bytes**, **max connections**, and **origin check** when the server is **not** bound to loopback.

## Dependency policy

Depends on **`@vnext-forge/app-contracts`** only. **No `apps/*` imports.** See [dependency-policy skill](./.cursor/skills/shared/dependency-policy/SKILL.md).

## Cross-references

- [`ADR 001 — Trust model`](./docs/architecture/adr/001-trust-model.md) (LSP WebSocket policy, non-loopback)
- [`.cursor/rules/server-hardening.mdc`](./.cursor/rules/server-hardening.mdc)
- [Web vs extension parity](./docs/architecture/web-extension-parity.md) (LSP / designer behavior alignment)
- [`./CLAUDE.SERVER.md`](./CLAUDE.SERVER.md), [`./CLAUDE.EXTENSION.md`](./CLAUDE.EXTENSION.md)
