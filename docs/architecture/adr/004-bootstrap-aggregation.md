# ADR 004: Workspace bootstrap RPC aggregation

**Status:** Accepted

## Context

Opening a project workspace required multiple round-trips (`getById`, tree, config status, layout status, validate script status, component file types). In **React 19 StrictMode** (development), effects run twice, **doubling** chatter (e.g. 6 → **12** calls).

## Decision

Add a single RPC: **`projects.getWorkspaceBootstrap`** (registered in `packages/services-core/src/registry/method-registry.ts`, implemented under `packages/services-core/src/services/project/`).

**Returns (conceptual):**

- Always: `project`, `tree`, `configStatus`.
- When `configStatus.status === 'ok'`: also `layoutStatus`, `validateScriptStatus`, `componentFileTypes` (computed in parallel server-side).
- When config is not OK: expensive fields are **`null`** (skip work).

**Call reduction:** StrictMode **12 → 2** RPC posts; production **6 → 1**.

## When to extend

- **Prefer adding a field** to this aggregate when it is part of the same "open workspace" snapshot, cheap to compute alongside existing data, and needed by the same screens.
- **Prefer a new RPC** when the data is **independent**, **large**, **optional for most sessions**, or belongs to a **different trust / capability** boundary.

## Consequences

- Faster workspace open, fewer races, simpler client hook (`apps/web/src/modules/project-workspace/hooks/useProjectWorkspacePage.ts`).
- The RPC payload may grow; watch serialization size and cache invalidation when adding fields.

## Alternatives considered

- **Client-side batching only** — rejected: does not fix StrictMode double-invocation cost.
- **GraphQL-style arbitrary field selection** — rejected: overkill for current scale; Zod-RPC registry stays explicit.
