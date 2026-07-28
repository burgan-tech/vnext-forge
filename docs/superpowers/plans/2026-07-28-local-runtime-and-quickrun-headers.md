# Managed Local Runtime + QuickRunner Global Headers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make QuickRunner forward Global Headers on every engine call, and let the Forge Environment panel provision, run and tear down a local Docker vNext runtime end to end.

**Architecture:** Phase A is a small refactor in `packages/designer-ui` extracting one header-merge helper and using it at the three delegate call sites that currently skip global headers. Phase B adds pure, unit-tested logic to `packages/services-core/src/services/local-runtime/` (deliberately **not** registered in the method registry, so no HTTP surface is created) and a VS Code orchestration layer in `apps/extension/src/tools/local-runtime/` that drives `git`, `make` and the container CLI, streaming output to the Output channel.

**Tech Stack:** TypeScript, vitest (services-core + designer-ui), VS Code extension API, esbuild, Node `child_process`, Docker/Podman, GNU Make.

**Spec:** [`docs/superpowers/specs/2026-07-28-local-runtime-and-quickrun-headers-design.md`](../specs/2026-07-28-local-runtime-and-quickrun-headers-design.md)

**Working directory:** all commands run from the repo root of the worktree
`.claude/worktrees/f+local-runtime-and-quickrun-headers` unless a step says otherwise.

---

## File Structure

**Phase A — `packages/designer-ui/src/modules/quick-run/pseudo-ui/`**

| File | Responsibility |
|---|---|
| `mergeQuickRunHeaders.ts` (new) | The single header-merge rule: global → session → extra. |
| `mergeQuickRunHeaders.vitest.test.ts` (new) | Unit tests for the merge rule. |
| `firePseudoUiTransition.ts` (modify) | Delegates its inline merge to the helper. Behaviour unchanged. |
| `createQuickRunPseudoDelegate.ts` (modify) | Uses the helper at `requestData`, `dispatch`→`fn`, `dispatch`→`flow-start`. |
| `createQuickRunPseudoDelegate.vitest.test.ts` (new) | Asserts merged headers reach `executeFunction` / `startInstance`. |

**Phase B — `packages/services-core/src/services/local-runtime/`** (pure, no `vscode`)

| File | Responsibility |
|---|---|
| `types.ts` | Shared types: `DomainPorts`, `ContainerRuntimeInfo`, `PreflightResult`, … |
| `port-math.ts` | `computeDomainPorts(offset)` — mirror of `create-domain.sh`. |
| `port-allocator.ts` | `findFreePortOffset()` — first offset whose five ports are all free. |
| `domain-env.ts` | `parseDomainEnv()` — read back an existing `domains/<d>/.env`. |
| `db-name.ts` | `normalizeDbName()`, `extractDbNameFromAppSettings()`. |
| `container-runtime.ts` | `detectContainerRuntime()` — docker/podman/OrbStack resolution. |
| `preflight.ts` | `evaluatePreflight()` — missing vs installed-but-stopped. |
| `commands.ts` | argv builders. Never a shell string. |
| `index.ts` | Barrel. |

**Phase B — `apps/extension/src/tools/local-runtime/`** (VS Code)

| File | Responsibility |
|---|---|
| `tool-lookup.ts` | `createToolLookup()` — PATH then well-known locations. |
| `process-runner.ts` | `runStreaming()` — spawn, stream, cancel, redact secrets. |
| `gitignore-writer.ts` | `ensureGitignoreEntry()`. |
| `local-runtime.service.ts` | The orchestrator used by the tree provider. |

**Phase B — modified**

| File | Change |
|---|---|
| `packages/services-core/src/services/cli/cli-schemas.ts` | Widen `cliDomainAddParams` with optional DB/docker fields. |
| `packages/services-core/src/services/cli/cli.service.ts` | Pass the new optional fields through to `wf domain add`. |
| `packages/services-core/src/index.ts` | Export the new `local-runtime` barrel. |
| `apps/extension/src/tools/forge-tools-settings.ts` | `EnvironmentKind`, `LocalRuntimeBinding`, parse/persist. |
| `apps/extension/src/tools/providers/environments-provider.ts` | Kind picker, local add flow, lifecycle actions, tree rendering. |
| `apps/extension/src/extension.ts` | Construct and inject `LocalRuntimeService`; register new commands. |
| `apps/extension/package.json` | New commands + `view/item/context` menu entries. |

---

# Phase A — QuickRunner global headers

### Task 1: Extract the header-merge rule

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.ts`
- Create: `packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/pseudo-ui/firePseudoUiTransition.ts`

- [ ] **Step 1: Write the failing test**

Create `mergeQuickRunHeaders.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { mergeQuickRunHeaders } from './mergeQuickRunHeaders';
import type { WorkflowBucketConfig } from '../QuickRunApi';

function makeConfig(globalHeaders: Record<string, string>): WorkflowBucketConfig {
  return {
    key: 'wf-1',
    globalHeaders,
    start: { headers: {}, queryStrings: {}, body: { attributes: {} } },
    transitions: [],
  };
}

describe('mergeQuickRunHeaders', () => {
  it('returns global headers when there are no session headers', () => {
    expect(mergeQuickRunHeaders(makeConfig({ 'X-Global': 'gv' }), undefined)).toEqual({
      'X-Global': 'gv',
    });
  });

  it('returns session headers when bucketConfig is null', () => {
    expect(mergeQuickRunHeaders(null, { 'X-Session': 'sv' })).toEqual({ 'X-Session': 'sv' });
  });

  it('returns an empty object when everything is absent', () => {
    expect(mergeQuickRunHeaders(undefined, undefined)).toEqual({});
  });

  it('merges both, with session winning on conflict', () => {
    const merged = mergeQuickRunHeaders(
      makeConfig({ 'X-Common': 'global', 'X-Global': 'gv' }),
      { 'X-Common': 'session', 'X-Session': 'sv' },
    );
    expect(merged).toEqual({ 'X-Common': 'session', 'X-Global': 'gv', 'X-Session': 'sv' });
  });

  it('lets extra headers win over both', () => {
    const merged = mergeQuickRunHeaders(
      makeConfig({ 'X-Common': 'global' }),
      { 'X-Common': 'session' },
      { 'X-Common': 'extra', 'X-Extra': 'ev' },
    );
    expect(merged).toEqual({ 'X-Common': 'extra', 'X-Extra': 'ev' });
  });

  it('does not mutate its inputs', () => {
    const cfg = makeConfig({ 'X-Global': 'gv' });
    const session = { 'X-Session': 'sv' };
    mergeQuickRunHeaders(cfg, session, { 'X-Extra': 'ev' });
    expect(cfg.globalHeaders).toEqual({ 'X-Global': 'gv' });
    expect(session).toEqual({ 'X-Session': 'sv' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/designer-ui && npx vitest run src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.vitest.test.ts`
Expected: FAIL — `Failed to resolve import "./mergeQuickRunHeaders"`.

- [ ] **Step 3: Write the implementation**

Create `mergeQuickRunHeaders.ts`:

```ts
import type { WorkflowBucketConfig } from '../QuickRunApi';

/**
 * The single header-merge rule for every Quick Run engine call.
 *
 * Priority, lowest → highest:
 *   `bucketConfig.globalHeaders` → `sessionHeaders` → `extra`
 *
 * `extra` exists for the per-transition delta the manual TransitionDialog
 * persists; ordinary callers omit it.
 *
 * Quick Run is the client's mini-simulation surface, so Global Headers must
 * ride along on *every* request it makes — transitions, function calls made
 * while rendering a view (`x-lov` lookups), function dispatches, and
 * flow-start. Anything that talks to the engine goes through here.
 */
export function mergeQuickRunHeaders(
  bucketConfig: WorkflowBucketConfig | null | undefined,
  sessionHeaders: Record<string, string> | undefined,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    ...(bucketConfig?.globalHeaders ?? {}),
    ...(sessionHeaders ?? {}),
    ...(extra ?? {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/designer-ui && npx vitest run src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.vitest.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Refactor `firePseudoUiTransition` onto the helper**

In `firePseudoUiTransition.ts`, add the import next to the existing ones:

```ts
import { mergeQuickRunHeaders } from './mergeQuickRunHeaders';
```

Replace this block:

```ts
  const globalHeaders = p.bucketConfig?.globalHeaders ?? {};
  const sessionHeaders = p.sessionHeaders ?? {};
  const prevEntry: TransitionBucketEntry | undefined = p.bucketConfig?.transitions?.find(
    (t) => t.key === p.transitionKey,
  );
  const perTransitionHeaders = prevEntry?.headers ?? {};

  const mergedHeaders: Record<string, string> = {
    ...globalHeaders,
    ...sessionHeaders,
    ...perTransitionHeaders,
  };
```

with:

```ts
  const prevEntry: TransitionBucketEntry | undefined = p.bucketConfig?.transitions?.find(
    (t) => t.key === p.transitionKey,
  );

  const mergedHeaders = mergeQuickRunHeaders(
    p.bucketConfig,
    p.sessionHeaders,
    prevEntry?.headers,
  );
```

- [ ] **Step 6: Run the existing regression lock plus the new test**

Run: `cd packages/designer-ui && npx vitest run src/modules/quick-run/pseudo-ui/`
Expected: PASS — the 7 pre-existing `firePseudoUiTransition` tests and the 6 new ones. The
"merges global, session, and per-transition headers in priority order" test is the lock that
proves the refactor changed nothing.

- [ ] **Step 7: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.ts packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.vitest.test.ts packages/designer-ui/src/modules/quick-run/pseudo-ui/firePseudoUiTransition.ts
git commit -m "refactor(quick-run): extract mergeQuickRunHeaders helper"
```

---

### Task 2: Forward global headers on function calls and flow-start

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/pseudo-ui/createQuickRunPseudoDelegate.ts`
- Create: `packages/designer-ui/src/modules/quick-run/pseudo-ui/createQuickRunPseudoDelegate.vitest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `createQuickRunPseudoDelegate.vitest.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../QuickRunApi', () => ({
  executeFunction: vi.fn(),
  startInstance: vi.fn(),
  fireTransition: vi.fn(),
}));

import * as QuickRunApi from '../QuickRunApi';
import type { WorkflowBucketConfig } from '../QuickRunApi';
import { createQuickRunPseudoDelegate } from './createQuickRunPseudoDelegate';

const mockedExecuteFunction = QuickRunApi.executeFunction as unknown as ReturnType<typeof vi.fn>;
const mockedStartInstance = QuickRunApi.startInstance as unknown as ReturnType<typeof vi.fn>;

const GLOBAL_HEADERS = { 'X-Common': 'global', 'X-Global': 'gv' };
const SESSION_HEADERS = { 'X-Common': 'session', 'X-Session': 'sv' };
const EXPECTED_MERGED = { 'X-Common': 'session', 'X-Global': 'gv', 'X-Session': 'sv' };

function makeConfig(): WorkflowBucketConfig {
  return {
    key: 'wf-1',
    globalHeaders: { ...GLOBAL_HEADERS },
    start: { headers: {}, queryStrings: {}, body: { attributes: {} } },
    transitions: [],
  };
}

function makeDelegate() {
  return createQuickRunPseudoDelegate({
    domain: 'core',
    workflowKey: 'wf',
    instanceId: 'inst-1',
    runtimeUrl: 'http://localhost:4201',
    getBucketConfig: () => makeConfig(),
    getSessionHeaders: () => ({ ...SESSION_HEADERS }),
    getBindingContext: () => ({ data: null, extensions: null }),
  });
}

describe('createQuickRunPseudoDelegate — global header propagation', () => {
  beforeEach(() => {
    mockedExecuteFunction.mockReset();
    mockedStartInstance.mockReset();
  });

  it('sends merged headers on requestData (x-lov lookup during view render)', async () => {
    mockedExecuteFunction.mockResolvedValueOnce({ success: true, data: { items: [] } });

    await makeDelegate().requestData?.('urn:vnext:fn:core:lookup-cities:get', { q: 'is' });

    expect(mockedExecuteFunction).toHaveBeenCalledTimes(1);
    expect(mockedExecuteFunction.mock.calls[0][0].headers).toEqual(EXPECTED_MERGED);
  });

  it('sends merged headers on a function dispatch', async () => {
    mockedExecuteFunction.mockResolvedValueOnce({ success: true, data: {} });

    await makeDelegate().onAction?.(
      'dispatch',
      { amount: '10' },
      'urn:vnext:fn:core:recalculate:post',
    );

    expect(mockedExecuteFunction).toHaveBeenCalledTimes(1);
    expect(mockedExecuteFunction.mock.calls[0][0].headers).toEqual(EXPECTED_MERGED);
  });

  it('sends merged headers on flow-start', async () => {
    mockedStartInstance.mockResolvedValueOnce({
      success: true,
      data: { id: 'new-1', key: 'k', status: 'ok' },
    });

    await makeDelegate().onAction?.('dispatch', { a: 1 }, 'urn:vnext:flow:start:core:onboarding');

    expect(mockedStartInstance).toHaveBeenCalledTimes(1);
    expect(mockedStartInstance.mock.calls[0][0].headers).toEqual(EXPECTED_MERGED);
  });
});
```

> The URN strings above must match what `parseVnextUrn` accepts. Before running, open
> `packages/designer-ui/src/modules/quick-run/pseudo-ui/parseVnextUrn.ts` and confirm the exact
> shapes for `kind: 'fn'` and `kind: 'flow-start'`; if they differ, use the real shapes (the
> assertion under test is the `headers` argument, not the URN grammar).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/designer-ui && npx vitest run src/modules/quick-run/pseudo-ui/createQuickRunPseudoDelegate.vitest.test.ts`
Expected: FAIL — all three assertions report `headers` equal to `{ 'X-Common': 'session', 'X-Session': 'sv' }`
(session only, no `X-Global`). That failure *is* the bug.

- [ ] **Step 3: Write the implementation**

In `createQuickRunPseudoDelegate.ts`, add the import:

```ts
import { mergeQuickRunHeaders } from './mergeQuickRunHeaders';
```

Inside `createQuickRunPseudoDelegate`, immediately after the existing
`const runtimeUrl = params.runtimeUrl || undefined;` line, add:

```ts
  /**
   * Quick Run acts as the client's mini-simulation, so Global Headers must
   * travel with every engine call — not just transitions. Read through the
   * live getters so the latest edits are picked up per dispatch.
   */
  const resolveHeaders = () =>
    mergeQuickRunHeaders(params.getBucketConfig(), params.getSessionHeaders());
```

Then replace `headers: params.getSessionHeaders(),` with `headers: resolveHeaders(),` at all
three call sites:

1. in `requestData`, the `QuickRunApi.executeFunction({ … })` call;
2. in `onAction` → `dispatch` → `parsed.kind === 'flow-start'`, the `QuickRunApi.startInstance({ … })` call;
3. in `onAction` → `dispatch` → `parsed.kind === 'fn'`, the `QuickRunApi.executeFunction({ … })` call.

Verify none are left behind:

```bash
grep -n "getSessionHeaders()" packages/designer-ui/src/modules/quick-run/pseudo-ui/createQuickRunPseudoDelegate.ts
```

Expected: exactly one remaining hit — the `sessionHeaders: params.getSessionHeaders(),` argument
passed to `firePseudoUiTransition`, which does its own merge and must stay as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/designer-ui && npx vitest run src/modules/quick-run/pseudo-ui/`
Expected: PASS — all pseudo-ui tests including the 3 new ones.

- [ ] **Step 5: Run the whole designer-ui suite**

Run: `cd packages/designer-ui && npx vitest run`
Expected: PASS — 337 pre-existing tests plus the 9 new ones, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run/pseudo-ui/createQuickRunPseudoDelegate.ts packages/designer-ui/src/modules/quick-run/pseudo-ui/createQuickRunPseudoDelegate.vitest.test.ts
git commit -m "fix(quick-run): forward global headers on function calls and flow-start

Global Headers rode along on transitions but not on the function calls
QuickRunner makes while rendering a view (x-lov lookups), on function
dispatches, or on flow-start. QuickRunner is the client's mini-simulation
surface, so every engine call must carry them."
```

---

# Phase B — Managed local runtime

### Task 3: Shared types + port math

**Files:**
- Create: `packages/services-core/src/services/local-runtime/types.ts`
- Create: `packages/services-core/src/services/local-runtime/port-math.ts`
- Create: `packages/services-core/test/local-runtime/port-math.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/services-core/test/local-runtime/port-math.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { computeDomainPorts, PORT_OFFSET_STEP } from '../../src/services/local-runtime/port-math.js'

describe('computeDomainPorts', () => {
  // Locked against vnext/docker/create-domain.sh:
  //   4201/4202/4203/4204/3005 + offset
  it('matches create-domain.sh for offset 0', () => {
    expect(computeDomainPorts(0)).toEqual({
      app: 4201,
      execution: 4202,
      inbox: 4203,
      outbox: 4204,
      init: 3005,
    })
  })

  it('matches create-domain.sh for offset 10', () => {
    expect(computeDomainPorts(10)).toEqual({
      app: 4211,
      execution: 4212,
      inbox: 4213,
      outbox: 4214,
      init: 3015,
    })
  })

  it('matches create-domain.sh for offset 20', () => {
    expect(computeDomainPorts(20)).toEqual({
      app: 4221,
      execution: 4222,
      inbox: 4223,
      outbox: 4224,
      init: 3025,
    })
  })

  it('exposes the 10-port step the offset must be a multiple of', () => {
    // Offset 1 would put this domain's app port (4202) on top of offset 0's
    // execution port, so offsets must advance in steps of 10.
    expect(PORT_OFFSET_STEP).toBe(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- port-math`
Expected: FAIL — cannot resolve `../../src/services/local-runtime/port-math.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/services-core/src/services/local-runtime/types.ts`:

```ts
/** Host ports a single vNext domain occupies. Mirrors create-domain.sh. */
export interface DomainPorts {
  app: number
  execution: number
  inbox: number
  outbox: number
  init: number
}

/** Which container tooling the host has, and how to label it in the UI. */
export interface ContainerRuntimeInfo {
  containerCli: { bin: 'docker' | 'podman'; path: string }
  /** e.g. ['docker','compose'] or ['podman-compose']. Informational: Forge
   *  never passes this to make — the Makefile does its own detection. */
  composeArgv: string[]
  flavor: 'orbstack' | 'docker' | 'podman'
}

export type ContainerRuntimeDetection =
  | { ok: true; info: ContainerRuntimeInfo }
  | { ok: false; reason: 'no-container-cli' | 'no-compose' }

export type PreflightProblem = 'missing' | 'not-running'

export interface PreflightIssue {
  tool: string
  problem: PreflightProblem
  helpUrl: string
}

export interface PreflightResult {
  ok: boolean
  issues: PreflightIssue[]
}

/** Resolves an executable name to an absolute path, or null when absent. */
export type ToolLookup = (bin: string) => string | null
```

Create `packages/services-core/src/services/local-runtime/port-math.ts`:

```ts
import type { DomainPorts } from './types.js'

/**
 * Offsets must advance in steps of 10.
 *
 * create-domain.sh lays the five service ports out one apart (4201..4204 plus
 * 3005) and derives the Dapr ports from `offset * 100`. An offset of 1 would
 * therefore put a new domain's app port (4202) on top of the previous
 * domain's execution port.
 */
export const PORT_OFFSET_STEP = 10

const BASE_APP_PORT = 4201
const BASE_EXECUTION_PORT = 4202
const BASE_INBOX_PORT = 4203
const BASE_OUTBOX_PORT = 4204
const BASE_INIT_PORT = 3005

/**
 * Mirror of `vnext/docker/create-domain.sh` in the vnext-runtime repo. Kept in
 * lockstep by a table test — if the runtime repo changes its port layout, that
 * test fails and this function must follow.
 */
export function computeDomainPorts(offset: number): DomainPorts {
  return {
    app: BASE_APP_PORT + offset,
    execution: BASE_EXECUTION_PORT + offset,
    inbox: BASE_INBOX_PORT + offset,
    outbox: BASE_OUTBOX_PORT + offset,
    init: BASE_INIT_PORT + offset,
  }
}

/** Every host port a domain at `offset` will bind. */
export function domainPortList(offset: number): number[] {
  const p = computeDomainPorts(offset)
  return [p.app, p.execution, p.inbox, p.outbox, p.init]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- port-math`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/local-runtime/types.ts packages/services-core/src/services/local-runtime/port-math.ts packages/services-core/test/local-runtime/port-math.test.ts
git commit -m "feat(local-runtime): port math mirroring create-domain.sh"
```

---

### Task 4: Port offset allocator

**Files:**
- Create: `packages/services-core/src/services/local-runtime/port-allocator.ts`
- Create: `packages/services-core/test/local-runtime/port-allocator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/services-core/test/local-runtime/port-allocator.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { findFreePortOffset } from '../../src/services/local-runtime/port-allocator.js'

const allFree = () => true

describe('findFreePortOffset', () => {
  it('returns 0 when nothing is used', async () => {
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree: allFree })).toBe(0)
  })

  it('skips offsets already recorded in the runtime clone', async () => {
    expect(await findFreePortOffset({ usedOffsets: [0, 10], isPortFree: allFree })).toBe(20)
  })

  it('rejects an offset when any single one of its five ports is taken', async () => {
    // 4203 is offset 0's inbox port — one busy port disqualifies the offset,
    // even though the other four are free.
    const isPortFree = async (port: number) => port !== 4203
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree })).toBe(10)
  })

  it('treats a busy init port as disqualifying too', async () => {
    const isPortFree = async (port: number) => port !== 3005
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree })).toBe(10)
  })

  it('combines recorded offsets and live port probing', async () => {
    // offset 0 recorded; offset 10 free on paper but its app port is bound by
    // another workspace's clone.
    const isPortFree = async (port: number) => port !== 4211
    expect(await findFreePortOffset({ usedOffsets: [0], isPortFree })).toBe(20)
  })

  it('returns null when no offset is free below maxOffset', async () => {
    const isPortFree = async () => false
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree, maxOffset: 20 })).toBeNull()
  })

  it('defaults maxOffset to 200', async () => {
    const isPortFree = async (port: number) => port >= 4401 // first free offset is 200
    expect(await findFreePortOffset({ usedOffsets: [], isPortFree })).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- port-allocator`
Expected: FAIL — cannot resolve `port-allocator.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/services-core/src/services/local-runtime/port-allocator.ts`:

```ts
import { domainPortList, PORT_OFFSET_STEP } from './port-math.js'

export interface FindFreePortOffsetParams {
  /** Offsets already recorded under the runtime clone's `domains/` directory. */
  usedOffsets: readonly number[]
  /** True when nothing is listening on `port` on the host. */
  isPortFree: (port: number) => boolean | Promise<boolean>
  /** Highest offset to consider. Default 200 → 21 candidate domains. */
  maxOffset?: number
}

export const DEFAULT_MAX_PORT_OFFSET = 200

/**
 * First offset whose five host ports are all free.
 *
 * Probing real host ports matters because the runtime clone lives inside the
 * workspace: another workspace's clone can already own an offset that this
 * clone's `domains/` directory knows nothing about.
 *
 * Returns null when every candidate up to `maxOffset` is taken; the caller
 * then asks the user for an offset instead of guessing.
 */
export async function findFreePortOffset(
  params: FindFreePortOffsetParams,
): Promise<number | null> {
  const maxOffset = params.maxOffset ?? DEFAULT_MAX_PORT_OFFSET
  const used = new Set(params.usedOffsets)

  for (let offset = 0; offset <= maxOffset; offset += PORT_OFFSET_STEP) {
    if (used.has(offset)) continue

    let allFree = true
    for (const port of domainPortList(offset)) {
      if (!(await params.isPortFree(port))) {
        allFree = false
        break
      }
    }
    if (allFree) return offset
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- port-allocator`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/local-runtime/port-allocator.ts packages/services-core/test/local-runtime/port-allocator.test.ts
git commit -m "feat(local-runtime): port offset allocator with live host probing"
```

---

### Task 5: Read back an existing domain `.env`

**Files:**
- Create: `packages/services-core/src/services/local-runtime/domain-env.ts`
- Create: `packages/services-core/test/local-runtime/domain-env.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/services-core/test/local-runtime/domain-env.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { parseDomainEnv } from '../../src/services/local-runtime/domain-env.js'

const REAL_ENV = `# VNext Domain Environment
DOMAIN_NAME=core
APP_DOMAIN=core
PORT_OFFSET=10

# Port Configuration
VNEXT_APP_PORT=4211
VNEXT_EXECUTION_PORT=4212
VNEXT_INBOX_PORT=4213
VNEXT_OUTBOX_PORT=4214
VNEXT_INIT_PORT=3015
`

describe('parseDomainEnv', () => {
  it('reads the offset and all five ports from a generated .env', () => {
    expect(parseDomainEnv(REAL_ENV)).toEqual({
      portOffset: 10,
      ports: { app: 4211, execution: 4212, inbox: 4213, outbox: 4214, init: 3015 },
    })
  })

  it('ignores comments, blank lines and surrounding whitespace', () => {
    const content = '  PORT_OFFSET = 20 \n#VNEXT_APP_PORT=9999\nVNEXT_APP_PORT=4221\n'
    const parsed = parseDomainEnv(content)
    expect(parsed?.portOffset).toBe(20)
    expect(parsed?.ports.app).toBe(4221)
  })

  it('derives missing ports from the offset', () => {
    // A hand-edited .env that kept PORT_OFFSET but lost a port line still
    // yields a complete, consistent port set.
    const parsed = parseDomainEnv('PORT_OFFSET=10\nVNEXT_APP_PORT=4211\n')
    expect(parsed?.ports).toEqual({
      app: 4211,
      execution: 4212,
      inbox: 4213,
      outbox: 4214,
      init: 3015,
    })
  })

  it('returns null when PORT_OFFSET is absent', () => {
    expect(parseDomainEnv('DOMAIN_NAME=core\n')).toBeNull()
  })

  it('returns null when PORT_OFFSET is not a number', () => {
    expect(parseDomainEnv('PORT_OFFSET=abc\n')).toBeNull()
  })

  it('returns null for empty content', () => {
    expect(parseDomainEnv('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- domain-env`
Expected: FAIL — cannot resolve `domain-env.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/services-core/src/services/local-runtime/domain-env.ts`:

```ts
import { computeDomainPorts } from './port-math.js'
import type { DomainPorts } from './types.js'

export interface DomainEnvInfo {
  portOffset: number
  ports: DomainPorts
}

/** Parse `KEY=VALUE` lines, skipping comments and blanks. */
function readEnvPairs(content: string): Map<string, string> {
  const pairs = new Map<string, string>()
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    pairs.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim())
  }
  return pairs
}

function readPort(pairs: Map<string, string>, key: string, fallback: number): number {
  const raw = pairs.get(key)
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Read an already-generated `domains/<domain>/.env` back.
 *
 * Provisioning is idempotent: when a domain directory already exists we must
 * use the ports it actually declares rather than recomputing them, so re-adding
 * a domain never shifts its ports. Individual port lines fall back to the
 * offset-derived value so a hand-edited file still yields a complete set.
 *
 * Returns null when the file carries no usable `PORT_OFFSET` — the caller then
 * treats the domain as unprovisioned.
 */
export function parseDomainEnv(content: string): DomainEnvInfo | null {
  const pairs = readEnvPairs(content)
  const rawOffset = pairs.get('PORT_OFFSET')
  if (rawOffset === undefined) return null

  const portOffset = Number.parseInt(rawOffset, 10)
  if (!Number.isFinite(portOffset) || portOffset < 0) return null

  const derived = computeDomainPorts(portOffset)
  return {
    portOffset,
    ports: {
      app: readPort(pairs, 'VNEXT_APP_PORT', derived.app),
      execution: readPort(pairs, 'VNEXT_EXECUTION_PORT', derived.execution),
      inbox: readPort(pairs, 'VNEXT_INBOX_PORT', derived.inbox),
      outbox: readPort(pairs, 'VNEXT_OUTBOX_PORT', derived.outbox),
      init: readPort(pairs, 'VNEXT_INIT_PORT', derived.init),
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- domain-env`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/local-runtime/domain-env.ts packages/services-core/test/local-runtime/domain-env.test.ts
git commit -m "feat(local-runtime): parse generated domain .env for idempotent reprovision"
```

---

### Task 6: Database name resolution

**Files:**
- Create: `packages/services-core/src/services/local-runtime/db-name.ts`
- Create: `packages/services-core/test/local-runtime/db-name.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/services-core/test/local-runtime/db-name.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  extractDbNameFromAppSettings,
  normalizeDbName,
} from '../../src/services/local-runtime/db-name.js'

describe('normalizeDbName', () => {
  // Mirrors create-domain.sh: non-alphanumerics become '_', then the first
  // character is upper-cased. The rest of the string is left alone.
  it('capitalises the first character', () => {
    expect(normalizeDbName('core')).toBe('vNext_Core')
  })

  it('replaces non-alphanumeric characters with underscores', () => {
    expect(normalizeDbName('my-domain')).toBe('vNext_My_domain')
  })

  it('leaves interior casing untouched', () => {
    expect(normalizeDbName('myDomain')).toBe('vNext_MyDomain')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDbName('  core  ')).toBe('vNext_Core')
  })

  it('returns null for an empty domain', () => {
    expect(normalizeDbName('')).toBeNull()
    expect(normalizeDbName('   ')).toBeNull()
  })
})

describe('extractDbNameFromAppSettings', () => {
  it('pulls the database out of a connection string', () => {
    const content = JSON.stringify({
      ConnectionStrings: {
        Default: 'Host=postgres;Port=5432;Database=vNext_Core;Username=postgres',
      },
    })
    expect(extractDbNameFromAppSettings(content)).toBe('vNext_Core')
  })

  it('handles the database appearing at the end without a trailing semicolon', () => {
    expect(extractDbNameFromAppSettings('"Host=postgres;Database=vNext_Sales"')).toBe(
      'vNext_Sales',
    )
  })

  it('returns null when there is no Database= segment', () => {
    expect(extractDbNameFromAppSettings('{"ConnectionStrings":{}}')).toBeNull()
  })

  it('returns null for unparseable input', () => {
    expect(extractDbNameFromAppSettings('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- db-name`
Expected: FAIL — cannot resolve `db-name.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/services-core/src/services/local-runtime/db-name.ts`:

```ts
/**
 * Mirror of the normalisation in `create-domain.sh`: non-alphanumeric
 * characters become underscores, then the first character is upper-cased.
 *
 * Prefer {@link extractDbNameFromAppSettings} whenever the generated files are
 * on disk. The runtime repo applies three *different* awk normalisations
 * across create-domain.sh, `make db-create` and `make change-domain`, so the
 * file the runtime actually uses is the only trustworthy source; this function
 * is the fallback for when it cannot be read.
 */
export function normalizeDbName(domain: string): string | null {
  const trimmed = domain.trim()
  if (trimmed.length === 0) return null
  const underscored = trimmed.replace(/[^a-zA-Z0-9]/g, '_')
  const normalized = underscored.charAt(0).toUpperCase() + underscored.slice(1)
  return `vNext_${normalized}`
}

/**
 * Read the database name out of a generated
 * `domains/<domain>/appsettings.Development.json` by matching the
 * `Database=<name>` segment of its connection string.
 */
export function extractDbNameFromAppSettings(content: string): string | null {
  const match = /Database=([^;"'\s]+)/.exec(content)
  const name = match?.[1]?.trim()
  return name !== undefined && name.length > 0 ? name : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- db-name`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/local-runtime/db-name.ts packages/services-core/test/local-runtime/db-name.test.ts
git commit -m "feat(local-runtime): resolve domain database name from generated appsettings"
```

---

### Task 7: Container runtime detection

**Files:**
- Create: `packages/services-core/src/services/local-runtime/container-runtime.ts`
- Create: `packages/services-core/test/local-runtime/container-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/services-core/test/local-runtime/container-runtime.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { detectContainerRuntime } from '../../src/services/local-runtime/container-runtime.js'
import type { ToolLookup } from '../../src/services/local-runtime/types.js'

/** Fake lookup: every listed binary resolves to /usr/local/bin/<name>. */
function lookupFor(...present: string[]): ToolLookup {
  const set = new Set(present)
  return (bin) => (set.has(bin) ? `/usr/local/bin/${bin}` : null)
}

/** Fake compose-subcommand probe: `docker compose` / `podman compose`. */
function composeFor(...present: string[]) {
  const set = new Set(present)
  return (argv: string[]) => set.has(argv.join(' '))
}

const noComposeSubcommand = () => false

describe('detectContainerRuntime', () => {
  it('reports OrbStack when orb and docker are both present', () => {
    const result = detectContainerRuntime(
      lookupFor('orb', 'docker'),
      composeFor('docker compose'),
    )
    expect(result).toEqual({
      ok: true,
      info: {
        containerCli: { bin: 'docker', path: '/usr/local/bin/docker' },
        composeArgv: ['docker', 'compose'],
        flavor: 'orbstack',
      },
    })
  })

  it('reports plain docker when orb is absent', () => {
    const result = detectContainerRuntime(lookupFor('docker'), composeFor('docker compose'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.flavor).toBe('docker')
    expect(result.info.containerCli.bin).toBe('docker')
  })

  it('does NOT claim docker when orb exists but the docker CLI does not', () => {
    // Deliberate divergence from the runtime repo's Makefile, which maps
    // `orb` -> docker unconditionally and then fails on the next command.
    const result = detectContainerRuntime(lookupFor('orb'), noComposeSubcommand)
    expect(result).toEqual({ ok: false, reason: 'no-container-cli' })
  })

  it('falls back to the standalone docker-compose binary', () => {
    const result = detectContainerRuntime(
      lookupFor('docker', 'docker-compose'),
      noComposeSubcommand,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.composeArgv).toEqual(['docker-compose'])
  })

  it('prefers podman only when docker is absent', () => {
    const result = detectContainerRuntime(
      lookupFor('docker', 'podman', 'podman-compose'),
      composeFor('docker compose'),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.containerCli.bin).toBe('docker')
  })

  it('detects podman with podman-compose', () => {
    const result = detectContainerRuntime(
      lookupFor('podman', 'podman-compose'),
      noComposeSubcommand,
    )
    expect(result).toEqual({
      ok: true,
      info: {
        containerCli: { bin: 'podman', path: '/usr/local/bin/podman' },
        composeArgv: ['podman-compose'],
        flavor: 'podman',
      },
    })
  })

  it('detects podman with the podman compose subcommand', () => {
    const result = detectContainerRuntime(lookupFor('podman'), composeFor('podman compose'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.composeArgv).toEqual(['podman', 'compose'])
  })

  it('reports no-compose when a container CLI exists without any compose', () => {
    expect(detectContainerRuntime(lookupFor('docker'), noComposeSubcommand)).toEqual({
      ok: false,
      reason: 'no-compose',
    })
  })

  it('reports no-container-cli when nothing is installed', () => {
    expect(detectContainerRuntime(lookupFor(), noComposeSubcommand)).toEqual({
      ok: false,
      reason: 'no-container-cli',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- container-runtime`
Expected: FAIL — cannot resolve `container-runtime.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/services-core/src/services/local-runtime/container-runtime.ts`:

```ts
import type { ContainerRuntimeDetection, ToolLookup } from './types.js'

/** True when `<argv>` is a working subcommand, e.g. ['docker','compose']. */
export type ComposeSubcommandProbe = (argv: string[]) => boolean

/**
 * Resolve which container tooling this host has.
 *
 * OrbStack is **not** a third runtime: it ships a Docker-compatible daemon
 * plus the `docker` CLI, and `orb` is only its management binary. Docker
 * Desktop, Colima and Rancher Desktop are the same story. So the real axis is
 * docker-CLI vs podman-CLI, and `flavor` is a label for user-facing wording.
 *
 * The ordering mirrors the vnext-runtime Makefile so Forge and `make` never
 * disagree — with one deliberate divergence: the Makefile maps `orb` to docker
 * unconditionally, which prints success and then fails when OrbStack's CLI
 * helpers are not linked. Here `orb` only sets the label; the `docker` binary
 * still has to resolve.
 */
export function detectContainerRuntime(
  lookup: ToolLookup,
  hasComposeSubcommand: ComposeSubcommandProbe,
): ContainerRuntimeDetection {
  const dockerPath = lookup('docker')
  const podmanPath = lookup('podman')

  if (dockerPath !== null) {
    const flavor = lookup('orb') !== null ? 'orbstack' : 'docker'
    const composeArgv = hasComposeSubcommand(['docker', 'compose'])
      ? ['docker', 'compose']
      : lookup('docker-compose') !== null
        ? ['docker-compose']
        : null
    if (composeArgv === null) return { ok: false, reason: 'no-compose' }
    return {
      ok: true,
      info: { containerCli: { bin: 'docker', path: dockerPath }, composeArgv, flavor },
    }
  }

  if (podmanPath !== null) {
    const composeArgv = lookup('podman-compose') !== null
      ? ['podman-compose']
      : hasComposeSubcommand(['podman', 'compose'])
        ? ['podman', 'compose']
        : null
    if (composeArgv === null) return { ok: false, reason: 'no-compose' }
    return {
      ok: true,
      info: { containerCli: { bin: 'podman', path: podmanPath }, composeArgv, flavor: 'podman' },
    }
  }

  return { ok: false, reason: 'no-container-cli' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- container-runtime`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/local-runtime/container-runtime.ts packages/services-core/test/local-runtime/container-runtime.test.ts
git commit -m "feat(local-runtime): detect docker/OrbStack/podman container tooling"
```

---

### Task 8: Preflight evaluation

**Files:**
- Create: `packages/services-core/src/services/local-runtime/preflight.ts`
- Create: `packages/services-core/test/local-runtime/preflight.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/services-core/test/local-runtime/preflight.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { evaluatePreflight } from '../../src/services/local-runtime/preflight.js'
import type { ContainerRuntimeDetection } from '../../src/services/local-runtime/types.js'

const dockerOk: ContainerRuntimeDetection = {
  ok: true,
  info: {
    containerCli: { bin: 'docker', path: '/usr/local/bin/docker' },
    composeArgv: ['docker', 'compose'],
    flavor: 'orbstack',
  },
}

describe('evaluatePreflight', () => {
  it('passes when git, make and a reachable runtime are present', () => {
    expect(
      evaluatePreflight({
        git: '/usr/bin/git',
        make: '/usr/bin/make',
        runtime: dockerOk,
        daemonReachable: true,
      }),
    ).toEqual({ ok: true, issues: [] })
  })

  it('reports git and make as missing', () => {
    const result = evaluatePreflight({
      git: null,
      make: null,
      runtime: dockerOk,
      daemonReachable: true,
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map((i) => [i.tool, i.problem])).toEqual([
      ['git', 'missing'],
      ['make', 'missing'],
    ])
  })

  it('distinguishes an installed-but-stopped daemon from a missing one', () => {
    const result = evaluatePreflight({
      git: '/usr/bin/git',
      make: '/usr/bin/make',
      runtime: dockerOk,
      daemonReachable: false,
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.problem).toBe('not-running')
    // The label follows the detected flavor so the message can say OrbStack.
    expect(result.issues[0]?.tool).toBe('OrbStack')
  })

  it('reports a missing container CLI', () => {
    const result = evaluatePreflight({
      git: '/usr/bin/git',
      make: '/usr/bin/make',
      runtime: { ok: false, reason: 'no-container-cli' },
      daemonReachable: null,
    })
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatchObject({ tool: 'Docker or Podman', problem: 'missing' })
  })

  it('reports a missing compose command separately', () => {
    const result = evaluatePreflight({
      git: '/usr/bin/git',
      make: '/usr/bin/make',
      runtime: { ok: false, reason: 'no-compose' },
      daemonReachable: null,
    })
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatchObject({ tool: 'Docker Compose', problem: 'missing' })
  })

  it('accumulates every problem in one result', () => {
    const result = evaluatePreflight({
      git: null,
      make: null,
      runtime: { ok: false, reason: 'no-container-cli' },
      daemonReachable: null,
    })
    expect(result.issues).toHaveLength(3)
  })

  it('gives every issue a help URL', () => {
    const result = evaluatePreflight({
      git: null,
      make: null,
      runtime: { ok: false, reason: 'no-container-cli' },
      daemonReachable: null,
    })
    for (const issue of result.issues) {
      expect(issue.helpUrl).toMatch(/^https:\/\//)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- preflight`
Expected: FAIL — cannot resolve `preflight.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/services-core/src/services/local-runtime/preflight.ts`:

```ts
import type {
  ContainerRuntimeDetection,
  PreflightIssue,
  PreflightResult,
} from './types.js'

export interface PreflightInput {
  /** Absolute path, or null when the binary could not be resolved. */
  git: string | null
  make: string | null
  runtime: ContainerRuntimeDetection
  /** Whether the container daemon answered. Null when no CLI was found. */
  daemonReachable: boolean | null
}

const HELP_URLS = {
  git: 'https://git-scm.com/downloads',
  make: 'https://www.gnu.org/software/make/',
  container: 'https://orbstack.dev',
  compose: 'https://docs.docker.com/compose/install/',
} as const

const FLAVOR_LABELS = {
  orbstack: 'OrbStack',
  docker: 'Docker',
  podman: 'Podman',
} as const

/**
 * Turn resolved tool paths into a user-facing verdict.
 *
 * "Installed but not running" is deliberately its own state: a stopped
 * OrbStack / Docker Desktop is the most common first-run failure, and telling
 * the user it is "not found" sends them off to reinstall something they
 * already have.
 */
export function evaluatePreflight(input: PreflightInput): PreflightResult {
  const issues: PreflightIssue[] = []

  if (input.git === null) {
    issues.push({ tool: 'git', problem: 'missing', helpUrl: HELP_URLS.git })
  }
  if (input.make === null) {
    issues.push({ tool: 'make', problem: 'missing', helpUrl: HELP_URLS.make })
  }

  if (!input.runtime.ok) {
    if (input.runtime.reason === 'no-container-cli') {
      issues.push({
        tool: 'Docker or Podman',
        problem: 'missing',
        helpUrl: HELP_URLS.container,
      })
    } else {
      issues.push({ tool: 'Docker Compose', problem: 'missing', helpUrl: HELP_URLS.compose })
    }
  } else if (input.daemonReachable === false) {
    issues.push({
      tool: FLAVOR_LABELS[input.runtime.info.flavor],
      problem: 'not-running',
      helpUrl: HELP_URLS.container,
    })
  }

  return { ok: issues.length === 0, issues }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- preflight`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/local-runtime/preflight.ts packages/services-core/test/local-runtime/preflight.test.ts
git commit -m "feat(local-runtime): preflight distinguishing missing from stopped daemon"
```

---

### Task 9: Command argv builders + barrel

**Files:**
- Create: `packages/services-core/src/services/local-runtime/commands.ts`
- Create: `packages/services-core/src/services/local-runtime/index.ts`
- Create: `packages/services-core/test/local-runtime/commands.test.ts`
- Modify: `packages/services-core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/services-core/test/local-runtime/commands.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  cloneArgv,
  containerInfoArgv,
  containerPsArgv,
  gitPullArgv,
  makeArgv,
  VNEXT_RUNTIME_DIR_NAME,
  VNEXT_RUNTIME_REPO_URL,
  wfDomainAddArgv,
} from '../../src/services/local-runtime/commands.js'

describe('argv builders', () => {
  it('builds a shallow clone into .vnext-runtime', () => {
    expect(cloneArgv()).toEqual([
      'clone',
      '--depth',
      '1',
      VNEXT_RUNTIME_REPO_URL,
      VNEXT_RUNTIME_DIR_NAME,
    ])
  })

  it('builds a fast-forward-only pull', () => {
    expect(gitPullArgv()).toEqual(['pull', '--ff-only'])
  })

  it('builds a bare make target', () => {
    expect(makeArgv('setup')).toEqual(['setup'])
  })

  it('passes DOMAIN as a make variable', () => {
    expect(makeArgv('up-vnext', { domain: 'core' })).toEqual(['up-vnext', 'DOMAIN=core'])
  })

  it('passes DOMAIN and PORT_OFFSET for create-domain', () => {
    expect(makeArgv('create-domain', { domain: 'core', portOffset: 10 })).toEqual([
      'create-domain',
      'DOMAIN=core',
      'PORT_OFFSET=10',
    ])
  })

  it('includes PORT_OFFSET when it is zero', () => {
    expect(makeArgv('create-domain', { domain: 'core', portOffset: 0 })).toEqual([
      'create-domain',
      'DOMAIN=core',
      'PORT_OFFSET=0',
    ])
  })

  it('anchors the container name filter so core does not match core2', () => {
    expect(containerPsArgv('vnext-app-core')).toEqual([
      'ps',
      '--all',
      '--filter',
      'name=^vnext-app-core$',
      '--format',
      '{{.Status}}',
    ])
  })

  it('builds the daemon reachability probe', () => {
    expect(containerInfoArgv()).toEqual(['info', '--format', '{{.ServerVersion}}'])
  })

  it('builds wf domain add with every discovered value', () => {
    expect(
      wfDomainAddArgv({
        domainName: 'core',
        apiBaseUrl: 'http://localhost:4201',
        dbName: 'vNext_Core',
      }),
    ).toEqual([
      'domain',
      'add',
      'core',
      '--API_BASE_URL',
      'http://localhost:4201',
      '--DB_NAME',
      'vNext_Core',
      '--DB_HOST',
      'localhost',
      '--DB_PORT',
      '5432',
      '--DB_USER',
      'postgres',
      '--DB_PASSWORD',
      'postgres',
      '--USE_DOCKER',
      'true',
      '--DOCKER_POSTGRES_CONTAINER',
      'vnext-postgres',
    ])
  })

  it('never emits a value containing a shell metacharacter boundary', () => {
    // Regression lock: everything is argv, so a domain name can never break
    // out into the shell.
    const argv = makeArgv('up-vnext', { domain: 'core; rm -rf /' })
    expect(argv).toEqual(['up-vnext', 'DOMAIN=core; rm -rf /'])
    expect(argv.join('\u0000')).not.toContain('\n')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/services-core test -- commands`
Expected: FAIL — cannot resolve `commands.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/services-core/src/services/local-runtime/commands.ts`:

```ts
export const VNEXT_RUNTIME_REPO_URL = 'https://github.com/burgan-tech/vnext-runtime.git'
export const VNEXT_RUNTIME_DIR_NAME = '.vnext-runtime'

/** Shared infrastructure defaults, fixed by the runtime repo's compose file. */
export const RUNTIME_POSTGRES = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  container: 'vnext-postgres',
} as const

export type MakeTarget =
  | 'setup'
  | 'up-infra'
  | 'create-domain'
  | 'db-create'
  | 'up-vnext'
  | 'down-vnext'
  | 'restart-vnext'

export interface MakeVars {
  domain?: string
  portOffset?: number
}

/**
 * Every builder returns an argv array — never a shell string. Values such as
 * the domain name come from `vnext.config.json` and user input, so keeping
 * them out of a shell is what makes them safe.
 */
export function makeArgv(target: MakeTarget, vars: MakeVars = {}): string[] {
  const argv: string[] = [target]
  if (vars.domain !== undefined) argv.push(`DOMAIN=${vars.domain}`)
  if (vars.portOffset !== undefined) argv.push(`PORT_OFFSET=${vars.portOffset}`)
  return argv
}

export function cloneArgv(): string[] {
  return ['clone', '--depth', '1', VNEXT_RUNTIME_REPO_URL, VNEXT_RUNTIME_DIR_NAME]
}

export function gitPullArgv(): string[] {
  return ['pull', '--ff-only']
}

/**
 * `--all` so a stopped container is still reported (absent vs stopped must be
 * distinguishable). The name filter is a regex, so it is anchored: an
 * unanchored `name=vnext-app-core` would also match `vnext-app-core2`.
 */
export function containerPsArgv(containerName: string): string[] {
  return ['ps', '--all', '--filter', `name=^${containerName}$`, '--format', '{{.Status}}']
}

export function containerInfoArgv(): string[] {
  return ['info', '--format', '{{.ServerVersion}}']
}

export function orchestrationContainerName(domain: string): string {
  return `vnext-app-${domain}`
}

export interface WfDomainAddParams {
  domainName: string
  apiBaseUrl: string
  dbName: string
}

/**
 * Every value here is discovered rather than asked: the URL from the allocated
 * app port, the database name from the generated appsettings, and the postgres
 * connection from the runtime repo's shared infrastructure defaults.
 */
export function wfDomainAddArgv(params: WfDomainAddParams): string[] {
  return [
    'domain',
    'add',
    params.domainName,
    '--API_BASE_URL',
    params.apiBaseUrl,
    '--DB_NAME',
    params.dbName,
    '--DB_HOST',
    RUNTIME_POSTGRES.host,
    '--DB_PORT',
    String(RUNTIME_POSTGRES.port),
    '--DB_USER',
    RUNTIME_POSTGRES.user,
    '--DB_PASSWORD',
    RUNTIME_POSTGRES.password,
    '--USE_DOCKER',
    'true',
    '--DOCKER_POSTGRES_CONTAINER',
    RUNTIME_POSTGRES.container,
  ]
}
```

Create `packages/services-core/src/services/local-runtime/index.ts`:

```ts
export * from './types.js'
export * from './port-math.js'
export * from './port-allocator.js'
export * from './domain-env.js'
export * from './db-name.js'
export * from './container-runtime.js'
export * from './preflight.js'
export * from './commands.js'
```

- [ ] **Step 4: Export from the package barrel**

In `packages/services-core/src/index.ts`, add after the `services/cli/index.js` export line:

```ts
export * from './services/local-runtime/index.js'
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @vnext-forge-studio/services-core test`
Expected: PASS — the 18 pre-existing tests plus 42 new ones across the six new files.

Run: `pnpm --filter @vnext-forge-studio/services-core build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/services-core/src/services/local-runtime/commands.ts packages/services-core/src/services/local-runtime/index.ts packages/services-core/src/index.ts packages/services-core/test/local-runtime/commands.test.ts
git commit -m "feat(local-runtime): argv builders and package barrel export"
```

---

### Task 10: Widen `wf domain add` parameters

**Files:**
- Modify: `packages/services-core/src/services/cli/cli-schemas.ts:86-93`
- Modify: `packages/services-core/src/services/cli/cli.service.ts:82-85` (interface) and `:289-298` (implementation)

- [ ] **Step 1: Widen the zod schema**

In `cli-schemas.ts`, replace the `cliDomainAddParams` definition with:

```ts
export const cliDomainAddParams = z
  .object({
    domainName: z.string().min(1),
    apiBaseUrl: z.string().url(),
    dbName: z.string().min(1),
    // Optional connection details. Managed local environments discover these
    // from the runtime repo's shared infrastructure; remote environments omit
    // them and let the CLI inherit from its default domain.
    dbHost: z.string().min(1).optional(),
    dbPort: z.number().int().min(1).max(65535).optional(),
    dbUser: z.string().min(1).optional(),
    dbPassword: z.string().min(1).optional(),
    useDocker: z.boolean().optional(),
    dockerPostgresContainer: z.string().min(1).optional(),
    timeoutMs: z.number().int().min(1).max(MAX_CLI_TIMEOUT_MS).optional(),
  })
  .strict()
```

- [ ] **Step 2: Widen the service interface**

In `cli.service.ts`, replace the `domainAdd` signature inside `export interface CliService`:

```ts
  domainAdd(
    params: {
      domainName: string
      apiBaseUrl: string
      dbName: string
      dbHost?: string
      dbPort?: number
      dbUser?: string
      dbPassword?: string
      useDocker?: boolean
      dockerPostgresContainer?: string
      timeoutMs?: number
    },
    traceId?: string,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>
```

- [ ] **Step 3: Pass the new flags through**

In `cli.service.ts`, replace the body of `domainAdd`:

```ts
    async domainAdd(params, _traceId): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      const timeoutMs = clampTimeout(params.timeoutMs)
      const argv = [
        'domain', 'add', params.domainName,
        '--API_BASE_URL', params.apiBaseUrl,
        '--DB_NAME', params.dbName,
      ]
      // Only forward what the caller actually knows; unspecified options are
      // inherited from the CLI's default domain.
      if (params.dbHost !== undefined) argv.push('--DB_HOST', params.dbHost)
      if (params.dbPort !== undefined) argv.push('--DB_PORT', String(params.dbPort))
      if (params.dbUser !== undefined) argv.push('--DB_USER', params.dbUser)
      if (params.dbPassword !== undefined) argv.push('--DB_PASSWORD', params.dbPassword)
      if (params.useDocker !== undefined) argv.push('--USE_DOCKER', String(params.useDocker))
      if (params.dockerPostgresContainer !== undefined) {
        argv.push('--DOCKER_POSTGRES_CONTAINER', params.dockerPostgresContainer)
      }
      const execOpts = execFileOptions(process.cwd(), timeoutMs)
      return runExecFile(WF_BINARY, argv, execOpts)
    },
```

- [ ] **Step 4: Verify the registry contract test still passes**

Run: `pnpm --filter @vnext-forge-studio/services-core test`
Expected: PASS. The existing `cli/domainAdd` fixture only supplies the three required fields,
and every new field is optional, so `registry-contract.test.ts` stays green.

Run: `pnpm --filter @vnext-forge-studio/services-core build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/cli/cli-schemas.ts packages/services-core/src/services/cli/cli.service.ts
git commit -m "feat(cli): accept optional DB and docker options on wf domain add"
```

---

### Task 11: Tool lookup and streaming process runner

**Files:**
- Create: `apps/extension/src/tools/local-runtime/tool-lookup.ts`
- Create: `apps/extension/src/tools/local-runtime/process-runner.ts`

> `apps/extension` has no test runner (see the spec's "Explicit gap"). These two files are
> verified by the type-check gate below and by the manual pass in Task 18.

**Type-check gate for every `apps/extension` task — use this, not the build.** Discovered during
Task 11: `pnpm --filter vnext-forge-studio build:host` runs esbuild, which **strips types without
checking them**. A passing host build says nothing about type correctness, so it is not a gate.

There is no `typecheck` script in that workspace, but the project can be checked directly:

```bash
npx tsc --noEmit -p apps/extension/tsconfig.json
```

That command is **red at baseline** with exactly four pre-existing errors, none of them in
local-runtime code:

- `src/commands.ts` — `TS2741` missing `mapping` in a `Record<VnextComponentType, string>`
- `src/commands.ts` — `TS2339` `description` does not exist on `InputBox`
- `src/extension.ts` (×2) — `TS2345` a `(uri: vscode.Uri) => …` handler not assignable to
  `safeAsync`'s `(...args: unknown[]) => Promise<unknown>`

The gate is therefore: **no error naming a file this branch created or modified**, and the
pre-existing four unchanged in kind. Do not "fix" them as a side effect — they are outside this
branch's scope. Note the two `extension.ts` errors sit near the command registrations Task 17
edits, so their **line numbers will shift**; match them by file and message, not by line.

- [ ] **Step 1: Write the tool lookup**

Create `apps/extension/src/tools/local-runtime/tool-lookup.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ToolLookup } from '@vnext-forge-studio/services-core';

/**
 * Locations to check when a binary is not on PATH.
 *
 * On macOS a VS Code launched from Dock/Finder inherits launchd's PATH
 * (`/usr/bin:/bin:/usr/sbin:/sbin`), which excludes `/usr/local/bin` and
 * `/opt/homebrew/bin` — exactly where docker, orb and docker-compose live.
 * VS Code usually repairs this by resolving the login shell environment, but
 * that can be disabled (`terminal.integrated.inheritEnv: false`) or fail on
 * unusual shell configs, and the symptom is a false "Docker not found".
 */
function wellKnownDirs(): string[] {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    return [
      path.join(programFiles, 'Docker', 'Docker', 'resources', 'bin'),
      path.join(programFiles, 'Git', 'cmd'),
      path.join(home, '.docker', 'bin'),
    ];
  }
  return [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    path.join(home, '.docker', 'bin'),
    path.join(home, '.rd', 'bin'),
  ];
}

const WINDOWS_EXTENSIONS = ['.exe', '.cmd', '.bat', ''];

function isExecutableFile(candidate: string): boolean {
  try {
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) return false;
    if (process.platform === 'win32') return true;
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveIn(dir: string, bin: string): string | null {
  const suffixes = process.platform === 'win32' ? WINDOWS_EXTENSIONS : [''];
  for (const suffix of suffixes) {
    const candidate = path.join(dir, `${bin}${suffix}`);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve an executable to an absolute path: PATH first, then the well-known
 * locations above. Returns null when the binary genuinely is not installed.
 */
export function createToolLookup(): ToolLookup {
  const cache = new Map<string, string | null>();

  return (bin: string): string | null => {
    const cached = cache.get(bin);
    if (cached !== undefined) return cached;

    const pathDirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
    let resolved: string | null = null;
    for (const dir of [...pathDirs, ...wellKnownDirs()]) {
      resolved = resolveIn(dir, bin);
      if (resolved !== null) break;
    }

    cache.set(bin, resolved);
    return resolved;
  };
}
```

- [ ] **Step 2: Write the process runner**

Create `apps/extension/src/tools/local-runtime/process-runner.ts`:

```ts
import { spawn } from 'node:child_process';

import {
  buildChildEnv,
  DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST,
} from '@vnext-forge-studio/services-core';
import type * as vscode from 'vscode';

export interface RunStreamingOptions {
  cwd: string;
  /** Called once per output line, stdout and stderr interleaved. */
  onLine: (line: string) => void;
  token?: vscode.CancellationToken;
}

export interface RunStreamingResult {
  exitCode: number;
  /** Everything emitted, already redacted. Used for error messages. */
  output: string;
  cancelled: boolean;
}

/**
 * Hide credentials passed as CLI flags before anything reaches the Output
 * channel. `postgres/postgres` is the runtime repo's public local-dev
 * credential, but a log is still the wrong place for it.
 */
export function redactSecrets(text: string): string {
  return text.replace(/(--DB_PASSWORD)(\s+|=)(\S+)/g, '$1$2***');
}

/**
 * Spawn a command and stream its output line by line.
 *
 * Provisioning chains several steps and each one's exit code decides whether
 * the next runs — which is why this exists instead of sending commands to a
 * terminal, where the completion signal is not reliable.
 */
export function runStreaming(
  file: string,
  argv: readonly string[],
  options: RunStreamingOptions,
): Promise<RunStreamingResult> {
  return new Promise((resolve) => {
    const child = spawn(file, [...argv], {
      cwd: options.cwd,
      env: buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST),
      shell: false,
    });

    let collected = '';
    let cancelled = false;
    let pending = '';

    const emit = (chunk: string) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const safe = redactSecrets(line);
        collected += `${safe}\n`;
        options.onLine(safe);
      }
    };

    child.stdout?.on('data', (d: Buffer) => emit(d.toString('utf8')));
    child.stderr?.on('data', (d: Buffer) => emit(d.toString('utf8')));

    const cancelSub = options.token?.onCancellationRequested(() => {
      cancelled = true;
      child.kill('SIGTERM');
    });

    const finish = (exitCode: number) => {
      if (pending.length > 0) {
        const safe = redactSecrets(pending);
        collected += `${safe}\n`;
        options.onLine(safe);
        pending = '';
      }
      cancelSub?.dispose();
      resolve({ exitCode, output: collected, cancelled });
    };

    child.on('error', (err) => {
      const safe = redactSecrets(err.message);
      collected += `${safe}\n`;
      options.onLine(safe);
      // ENOENT here means our resolved path went stale; the caller re-detects.
      finish(127);
    });

    child.on('close', (code) => finish(code ?? 1));
  });
}
```

- [ ] **Step 3: Verify the host build compiles**

Run: `pnpm --filter vnext-forge-studio build:host`
Expected: exit 0, esbuild writes `dist/extension.js`.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/src/tools/local-runtime/tool-lookup.ts apps/extension/src/tools/local-runtime/process-runner.ts
git commit -m "feat(local-runtime): tool lookup with PATH fallback and streaming runner"
```

---

### Task 12: Gitignore writer

**Files:**
- Create: `apps/extension/src/tools/local-runtime/gitignore-writer.ts`

- [ ] **Step 1: Write the implementation**

Create `apps/extension/src/tools/local-runtime/gitignore-writer.ts`:

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Ensure `entry` is present in the workspace `.gitignore`.
 *
 * The runtime clone lives inside the workspace so the developer can see it and
 * drop to `make` by hand — which means it must never be committed. Idempotent:
 * an entry that is already there (in any position) is left alone.
 */
export async function ensureGitignoreEntry(
  workspacePath: string,
  entry: string,
): Promise<void> {
  const gitignorePath = path.join(workspacePath, '.gitignore');

  let existing = '';
  try {
    existing = await fs.readFile(gitignorePath, 'utf-8');
  } catch {
    // No .gitignore yet — we create one below.
  }

  const alreadyPresent = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === entry);
  if (alreadyPresent) return;

  const needsNewline = existing.length > 0 && !existing.endsWith('\n');
  const addition = `${needsNewline ? '\n' : ''}\n# vNext Forge managed local runtime\n${entry}\n`;
  await fs.writeFile(gitignorePath, existing + addition, 'utf-8');
}
```

- [ ] **Step 2: Verify the host build compiles**

Run: `pnpm --filter vnext-forge-studio build:host`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/src/tools/local-runtime/gitignore-writer.ts
git commit -m "feat(local-runtime): idempotent .gitignore entry for the runtime clone"
```

---

### Task 13: Environment settings model

**Files:**
- Modify: `apps/extension/src/tools/forge-tools-settings.ts:35-46` (types), `:203-237` (`parseEnvironments`), `:331-343` (`addEnvironment`)

- [ ] **Step 1: Add the new types**

In `forge-tools-settings.ts`, replace the `RuntimeEnvironment` / `EnvironmentsConfig` block:

```ts
export type EnvironmentKind = 'remote' | 'local-docker';

/** Ports a managed local domain occupies on the host. */
export interface LocalRuntimePorts {
  app: number;
  execution: number;
  inbox: number;
  outbox: number;
  init: number;
}

/** Everything needed to drive a managed local runtime after it is provisioned. */
export interface LocalRuntimeBinding {
  /** Domain from the workspace's vnext.config.json. */
  domain: string;
  portOffset: number;
  /** Absolute path of the clone: <workspacePath>/.vnext-runtime */
  runtimePath: string;
  /** Workspace root that owns this runtime. */
  workspacePath: string;
  ports: LocalRuntimePorts;
}

export interface RuntimeEnvironment {
  id: string;
  name: string;
  baseUrl: string;
  dbName?: string;
  /** Undefined means 'remote' — keeps pre-existing environments.json valid. */
  kind?: EnvironmentKind;
  /** Present only when kind === 'local-docker'. */
  local?: LocalRuntimeBinding;
}

export interface EnvironmentsConfig {
  version: number;
  environments: RuntimeEnvironment[];
  activeEnvironmentId: string | null;
}
```

- [ ] **Step 2: Validate the new fields on load**

In `forge-tools-settings.ts`, add these helpers directly above `function parseEnvironments`:

```ts
function parsePositiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function parseLocalRuntimePorts(raw: unknown): LocalRuntimePorts | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const app = parsePositiveInt(o.app);
  const execution = parsePositiveInt(o.execution);
  const inbox = parsePositiveInt(o.inbox);
  const outbox = parsePositiveInt(o.outbox);
  const init = parsePositiveInt(o.init);
  if (app === null || execution === null || inbox === null || outbox === null || init === null) {
    return null;
  }
  return { app, execution, inbox, outbox, init };
}

/**
 * Returns null when the binding is unusable. The caller then downgrades the
 * environment to 'remote' rather than dropping it: the base URL still works,
 * only the lifecycle actions go away.
 */
function parseLocalRuntimeBinding(raw: unknown): LocalRuntimeBinding | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ports = parseLocalRuntimePorts(o.ports);
  if (
    typeof o.domain !== 'string' || o.domain.length === 0 ||
    typeof o.runtimePath !== 'string' || o.runtimePath.length === 0 ||
    typeof o.workspacePath !== 'string' || o.workspacePath.length === 0 ||
    typeof o.portOffset !== 'number' || !Number.isInteger(o.portOffset) || o.portOffset < 0 ||
    ports === null
  ) {
    return null;
  }
  return {
    domain: o.domain,
    portOffset: o.portOffset,
    runtimePath: o.runtimePath,
    workspacePath: o.workspacePath,
    ports,
  };
}
```

Then, inside `parseEnvironments`, replace the `environments.push({ … })` call with:

```ts
        const local = rec.kind === 'local-docker' ? parseLocalRuntimeBinding(rec.local) : null;
        environments.push({
          id: rec.id as string,
          name: rec.name as string,
          baseUrl: rawUrl,
          ...(typeof rec.dbName === 'string' && rec.dbName.length > 0 ? { dbName: rec.dbName } : {}),
          // A malformed binding downgrades the entry to remote instead of
          // dropping it — the URL is still usable.
          ...(local ? { kind: 'local-docker' as const, local } : { kind: 'remote' as const }),
        });
```

- [ ] **Step 3: Let `addEnvironment` persist a binding**

In `forge-tools-settings.ts`, replace `addEnvironment`:

```ts
  async addEnvironment(
    name: string,
    baseUrl: string,
    dbName?: string,
    binding?: LocalRuntimeBinding,
  ): Promise<RuntimeEnvironment> {
    const config = await this.loadEnvironments();
    const env: RuntimeEnvironment = {
      id: crypto.randomUUID(),
      name,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      ...(dbName ? { dbName } : {}),
      ...(binding ? { kind: 'local-docker' as const, local: binding } : { kind: 'remote' as const }),
    };
    config.environments.push(env);
    config.activeEnvironmentId ??= env.id;
    await this.saveEnvironments(config);
    return env;
  }
```

- [ ] **Step 4: Verify the host build compiles**

Run: `pnpm --filter vnext-forge-studio build:host`
Expected: exit 0. The existing `addEnvironment(name, baseUrl, dbName)` call in
`environments-provider.ts` still compiles because `binding` is optional.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/tools/forge-tools-settings.ts
git commit -m "feat(environments): model managed local-docker environments"
```

---

### Task 14: Local runtime orchestrator — provisioning

**Files:**
- Create: `apps/extension/src/tools/local-runtime/local-runtime.service.ts`

- [ ] **Step 1: Write the service skeleton and preflight**

Create `apps/extension/src/tools/local-runtime/local-runtime.service.ts`:

```ts
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as path from 'node:path';

import * as vscode from 'vscode';
import {
  cloneArgv,
  computeDomainPorts,
  containerInfoArgv,
  containerPsArgv,
  detectContainerRuntime,
  evaluatePreflight,
  extractDbNameFromAppSettings,
  findFreePortOffset,
  gitPullArgv,
  makeArgv,
  normalizeDbName,
  orchestrationContainerName,
  parseDomainEnv,
  PORT_OFFSET_STEP,
  VNEXT_RUNTIME_DIR_NAME,
  type ContainerRuntimeDetection,
  type ContainerRuntimeInfo,
  type PreflightResult,
} from '@vnext-forge-studio/services-core';
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts';

import type { LocalRuntimeBinding } from '../forge-tools-settings.js';
import { createToolLookup } from './tool-lookup.js';
import { ensureGitignoreEntry } from './gitignore-writer.js';
import { runStreaming } from './process-runner.js';

export type ContainerState = 'running' | 'stopped' | 'absent';

export interface ProvisionParams {
  workspacePath: string;
  domain: string;
  portOffset: number;
}

export interface ProvisionResult {
  binding: LocalRuntimeBinding;
  baseUrl: string;
  dbName: string;
  healthy: boolean;
}

const HEALTH_POLL_INTERVAL_MS = 3_000;
const HEALTH_TIMEOUT_MS = 90_000;

export class LocalRuntimeService {
  private readonly lookup = createToolLookup();
  private runtimeInfo: ContainerRuntimeInfo | undefined;

  constructor(private readonly output: vscode.OutputChannel) {}

  private log(line: string): void {
    this.output.appendLine(line);
  }

  /**
   * `docker compose version` (or `podman compose version`) exits 0 only when
   * the subcommand actually exists — that is the probe the pure detector needs.
   */
  private readonly composeProbe = (argv: string[]): boolean => {
    const bin = this.lookup(argv[0] ?? '');
    if (bin === null) return false;
    const probe = spawnSync(bin, [...argv.slice(1), 'version'], { encoding: 'utf8' });
    return probe.status === 0;
  };

  private detect(): ContainerRuntimeDetection {
    return detectContainerRuntime(this.lookup, this.composeProbe);
  }

  /** Resolve the container CLI once; callers re-detect after a stale-path failure. */
  private resolveRuntime(): ContainerRuntimeInfo | null {
    if (this.runtimeInfo) return this.runtimeInfo;
    const detection = this.detect();
    if (!detection.ok) return null;
    this.runtimeInfo = detection.info;
    return this.runtimeInfo;
  }

  async detectPreflight(): Promise<PreflightResult> {
    const runtimeDetection = this.detect();

    let daemonReachable: boolean | null = null;
    if (runtimeDetection.ok) {
      const result = await runStreaming(
        runtimeDetection.info.containerCli.path,
        containerInfoArgv(),
        { cwd: process.cwd(), onLine: () => {} },
      );
      daemonReachable = result.exitCode === 0;
    }

    return evaluatePreflight({
      git: this.lookup('git'),
      make: this.lookup('make'),
      runtime: runtimeDetection,
      daemonReachable,
    });
  }

  /** True when nothing is listening on `port`. */
  async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, '127.0.0.1');
    });
  }

  /** Offsets already recorded under the clone's `domains/` directory. */
  async readUsedOffsets(runtimePath: string): Promise<number[]> {
    const domainsDir = path.join(runtimePath, 'vnext', 'docker', 'domains');
    const offsets: number[] = [];
    let entries: string[] = [];
    try {
      entries = await fs.readdir(domainsDir);
    } catch {
      return offsets;
    }
    for (const entry of entries) {
      try {
        const content = await fs.readFile(path.join(domainsDir, entry, '.env'), 'utf-8');
        const parsed = parseDomainEnv(content);
        if (parsed) offsets.push(parsed.portOffset);
      } catch {
        // Not a provisioned domain directory — ignore.
      }
    }
    return offsets;
  }

  /**
   * Suggest the first offset whose five host ports are all free. Probing real
   * ports (not just this clone's `domains/`) matters because the clone lives
   * inside the workspace: another workspace's clone may already own an offset.
   */
  async suggestPortOffset(workspacePath: string): Promise<number | null> {
    const runtimePath = path.join(workspacePath, VNEXT_RUNTIME_DIR_NAME);
    const usedOffsets = await this.readUsedOffsets(runtimePath);
    return findFreePortOffset({
      usedOffsets,
      isPortFree: (port) => this.isPortFree(port),
    });
  }

  static isValidPortOffset(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value % PORT_OFFSET_STEP === 0;
  }
}
```

- [ ] **Step 2: Add the step runner and the provision pipeline**

Append these methods inside the `LocalRuntimeService` class, before the closing brace:

```ts
  /** Run one step; a non-zero exit becomes a VnextForgeError. */
  private async step(
    label: string,
    file: string,
    argv: readonly string[],
    cwd: string,
    token: vscode.CancellationToken,
  ): Promise<void> {
    this.log(`\n$ ${path.basename(file)} ${argv.join(' ')}   (cwd: ${cwd})`);
    const result = await runStreaming(file, argv, {
      cwd,
      onLine: (line) => this.log(line),
      token,
    });
    if (result.cancelled) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_EXECUTION_FAILED,
        `${label} was cancelled.`,
        { source: 'LocalRuntimeService.step', layer: 'application' },
      );
    }
    if (result.exitCode !== 0) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_EXECUTION_FAILED,
        `${label} failed (exit ${result.exitCode}). See the vnext-forge-studio output for details.`,
        {
          source: 'LocalRuntimeService.step',
          layer: 'application',
          details: { label, exitCode: result.exitCode },
        },
      );
    }
  }

  private requireTool(bin: string): string {
    const resolved = this.lookup(bin);
    if (resolved === null) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_NOT_AVAILABLE,
        `${bin} could not be found. Install it and try again.`,
        { source: 'LocalRuntimeService.requireTool', layer: 'application' },
      );
    }
    return resolved;
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  /** Whether the shared infrastructure (vnext-postgres) is already running. */
  private async isInfraRunning(): Promise<boolean> {
    const runtime = this.resolveRuntime();
    if (!runtime) return false;
    const result = await runStreaming(
      runtime.containerCli.path,
      containerPsArgv('vnext-postgres'),
      { cwd: process.cwd(), onLine: () => {} },
    );
    return result.exitCode === 0 && /\bUp\b/i.test(result.output);
  }

  private async waitForHealth(appPort: number): Promise<boolean> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://localhost:${appPort}/health`);
        if (res.ok) return true;
      } catch {
        // Not up yet.
      }
      await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
    }
    return false;
  }

  /**
   * Clone, configure and start a local runtime for `domain`.
   *
   * Every step is idempotent, so a cancelled or failed run can simply be
   * repeated: it picks up from whatever is already on disk.
   */
  async provision(
    params: ProvisionParams,
    progress: vscode.Progress<{ message?: string }>,
    token: vscode.CancellationToken,
  ): Promise<ProvisionResult> {
    const git = this.requireTool('git');
    const make = this.requireTool('make');
    const runtimePath = path.join(params.workspacePath, VNEXT_RUNTIME_DIR_NAME);
    const dockerDir = path.join(runtimePath, 'vnext', 'docker');
    const domainDir = path.join(dockerDir, 'domains', params.domain);

    // 1 — clone
    if (!(await this.pathExists(runtimePath))) {
      progress.report({ message: 'Cloning the vNext runtime…' });
      await this.step('Cloning the runtime', git, cloneArgv(), params.workspacePath, token);
    } else {
      this.log(`Runtime clone already present at ${runtimePath}; skipping clone.`);
    }

    // 2 — gitignore
    await ensureGitignoreEntry(params.workspacePath, `${VNEXT_RUNTIME_DIR_NAME}/`);

    // 3 — setup
    progress.report({ message: 'Preparing the runtime environment…' });
    await this.step('make setup', make, makeArgv('setup'), runtimePath, token);

    // 4 — domain configuration
    let portOffset = params.portOffset;
    const domainEnvPath = path.join(domainDir, '.env');
    if (await this.pathExists(domainEnvPath)) {
      const parsed = parseDomainEnv(await fs.readFile(domainEnvPath, 'utf-8'));
      if (parsed) {
        portOffset = parsed.portOffset;
        this.log(`Domain "${params.domain}" already configured at offset ${portOffset}; reusing it.`);
      }
    } else {
      progress.report({ message: `Creating domain configuration (offset ${portOffset})…` });
      await this.step(
        'make create-domain',
        make,
        makeArgv('create-domain', { domain: params.domain, portOffset }),
        runtimePath,
        token,
      );
    }
    const ports = computeDomainPorts(portOffset);

    // 5 — shared infrastructure
    if (await this.isInfraRunning()) {
      this.log('Shared infrastructure already running; skipping make up-infra.');
    } else {
      progress.report({ message: 'Starting shared infrastructure…' });
      await this.step('make up-infra', make, makeArgv('up-infra'), runtimePath, token);
    }

    // 6 — database
    progress.report({ message: 'Creating the domain database…' });
    await this.step(
      'make db-create',
      make,
      makeArgv('db-create', { domain: params.domain }),
      runtimePath,
      token,
    );

    // 7 — start
    progress.report({ message: 'Starting the runtime containers…' });
    await this.step(
      'make up-vnext',
      make,
      makeArgv('up-vnext', { domain: params.domain }),
      runtimePath,
      token,
    );

    // 8 — health
    progress.report({ message: 'Waiting for the runtime to report healthy…' });
    const healthy = await this.waitForHealth(ports.app);
    if (!healthy) {
      this.log(`Runtime did not report healthy within ${HEALTH_TIMEOUT_MS / 1000}s.`);
    }

    // DB name: trust the generated file over any recomputation.
    let dbName = normalizeDbName(params.domain) ?? `vNext_${params.domain}`;
    try {
      const appSettings = await fs.readFile(
        path.join(domainDir, 'appsettings.Development.json'),
        'utf-8',
      );
      dbName = extractDbNameFromAppSettings(appSettings) ?? dbName;
    } catch {
      this.log('Could not read the generated appsettings; falling back to the derived DB name.');
    }

    return {
      binding: {
        domain: params.domain,
        portOffset,
        runtimePath,
        workspacePath: params.workspacePath,
        ports,
      },
      baseUrl: `http://localhost:${ports.app}`,
      dbName,
      healthy,
    };
  }

  /** Values for `wf domain add` once provisioning has discovered them. */
  buildDomainAddArgs(binding: LocalRuntimeBinding, dbName: string) {
    return {
      domainName: binding.domain,
      apiBaseUrl: `http://localhost:${binding.ports.app}`,
      dbName,
      dbHost: 'localhost',
      dbPort: 5432,
      dbUser: 'postgres',
      dbPassword: 'postgres',
      useDocker: true,
      dockerPostgresContainer: 'vnext-postgres',
    };
  }
```

> `wfDomainAddArgv` from `commands.ts` builds the same argv for callers that spawn `wf`
> directly. The extension goes through `CliService.domainAdd` instead, so it needs the object
> form above; both encode the same discovered values.

- [ ] **Step 3: Verify the host build compiles**

Run: `pnpm --filter vnext-forge-studio build:host`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/src/tools/local-runtime/local-runtime.service.ts
git commit -m "feat(local-runtime): provisioning pipeline with idempotent steps"
```

---

### Task 15: Local runtime orchestrator — lifecycle

**Files:**
- Modify: `apps/extension/src/tools/local-runtime/local-runtime.service.ts`

- [ ] **Step 1: Add the lifecycle methods**

Append inside the `LocalRuntimeService` class:

```ts
  /** running | stopped | absent for a domain's orchestration container. */
  async getContainerState(binding: LocalRuntimeBinding): Promise<ContainerState> {
    const runtime = this.resolveRuntime();
    if (!runtime) return 'absent';
    const result = await runStreaming(
      runtime.containerCli.path,
      containerPsArgv(orchestrationContainerName(binding.domain)),
      { cwd: process.cwd(), onLine: () => {} },
    );
    if (result.exitCode !== 0) return 'absent';
    const status = result.output.trim();
    if (status.length === 0) return 'absent';
    return /^Up\b/i.test(status) ? 'running' : 'stopped';
  }

  /** True when the clone and this domain's configuration are both on disk. */
  async isProvisioned(binding: LocalRuntimeBinding): Promise<boolean> {
    const domainEnv = path.join(
      binding.runtimePath, 'vnext', 'docker', 'domains', binding.domain, '.env',
    );
    return (await this.pathExists(binding.runtimePath)) && (await this.pathExists(domainEnv));
  }

  async start(
    binding: LocalRuntimeBinding,
    progress: vscode.Progress<{ message?: string }>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const make = this.requireTool('make');
    if (!(await this.isInfraRunning())) {
      progress.report({ message: 'Starting shared infrastructure…' });
      await this.step('make up-infra', make, makeArgv('up-infra'), binding.runtimePath, token);
    }
    progress.report({ message: `Starting ${binding.domain}…` });
    await this.step(
      'make up-vnext',
      make,
      makeArgv('up-vnext', { domain: binding.domain }),
      binding.runtimePath,
      token,
    );
  }

  async stop(
    binding: LocalRuntimeBinding,
    progress: vscode.Progress<{ message?: string }>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const make = this.requireTool('make');
    progress.report({ message: `Stopping ${binding.domain}…` });
    await this.step(
      'make down-vnext',
      make,
      makeArgv('down-vnext', { domain: binding.domain }),
      binding.runtimePath,
      token,
    );
  }

  async restart(
    binding: LocalRuntimeBinding,
    progress: vscode.Progress<{ message?: string }>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const make = this.requireTool('make');
    progress.report({ message: `Restarting ${binding.domain}…` });
    await this.step(
      'make restart-vnext',
      make,
      makeArgv('restart-vnext', { domain: binding.domain }),
      binding.runtimePath,
      token,
    );
  }

  /**
   * Stop the containers and remove this domain's generated configuration.
   * The database and the clone are deliberately preserved.
   */
  async teardown(
    binding: LocalRuntimeBinding,
    progress: vscode.Progress<{ message?: string }>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    await this.stop(binding, progress, token);
    progress.report({ message: 'Removing the domain configuration…' });
    const domainDir = path.join(
      binding.runtimePath, 'vnext', 'docker', 'domains', binding.domain,
    );
    await fs.rm(domainDir, { recursive: true, force: true });
    this.log(`Removed ${domainDir}`);
  }

  async updateRuntime(
    binding: LocalRuntimeBinding,
    progress: vscode.Progress<{ message?: string }>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const git = this.requireTool('git');
    progress.report({ message: 'Updating the runtime clone…' });
    await this.step('git pull', git, gitPullArgv(), binding.runtimePath, token);
  }
```

- [ ] **Step 2: Verify the host build compiles**

Run: `pnpm --filter vnext-forge-studio build:host`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/src/tools/local-runtime/local-runtime.service.ts
git commit -m "feat(local-runtime): start/stop/restart/teardown/update lifecycle"
```

---

### Task 16: Environment panel — kind picker, local flow, lifecycle UI

**Files:**
- Modify: `apps/extension/src/tools/providers/environments-provider.ts`

- [ ] **Step 1: Accept the service and split the add flow by kind**

In `environments-provider.ts`, extend the imports:

```ts
import { LocalRuntimeService, type ContainerState } from '../local-runtime/local-runtime.service.js';
import type { LocalRuntimeBinding } from '../forge-tools-settings.js';
```

> `RuntimeEnvironment` and `HealthStatus` are already imported at the top of this file and are
> reused below; do not add duplicate imports for them.

Add a sixth constructor parameter:

```ts
    private readonly localRuntime?: LocalRuntimeService,
```

Replace `addEnvironment()` with a dispatcher plus the existing remote flow renamed:

```ts
  async addEnvironment(): Promise<void> {
    // Managed local runtimes are only offered when the service is wired.
    if (!this.localRuntime) {
      await this.addRemoteEnvironment();
      return;
    }

    const kind = await vscode.window.showQuickPick(
      [
        {
          label: 'Local (managed Docker runtime)',
          description: 'Forge clones the runtime, allocates ports, and starts Docker for you.',
          value: 'local' as const,
        },
        {
          label: 'Remote / existing',
          description: 'Connect to a vNext platform that is already running.',
          value: 'remote' as const,
        },
      ],
      { title: 'Add Environment', placeHolder: 'What kind of environment?', ignoreFocusOut: true },
    );
    if (!kind) return;

    if (kind.value === 'remote') {
      await this.addRemoteEnvironment();
      return;
    }
    await this.addLocalEnvironment();
  }
```

Then rename the **existing** `addEnvironment` body to `private async addRemoteEnvironment(): Promise<void>`
without changing a line of its logic — the remote path must behave exactly as before.

- [ ] **Step 2: Implement the local flow**

Add these methods to `EnvironmentsProvider`:

```ts
  /** Resolve the workspace root the user wants to provision for. */
  private async pickWorkspaceRoot(): Promise<VnextWorkspaceRoot | undefined> {
    const roots = this.detector?.getRoots() ?? [];
    if (roots.length === 0) return undefined;
    if (roots.length === 1) return roots[0];
    const pick = await vscode.window.showQuickPick(
      roots.map((r) => ({
        label: r.folderPath.split(/[\\/]/).pop() ?? r.folderPath,
        description: r.folderPath,
        root: r,
      })),
      {
        title: 'Select vNext workspace for the local runtime',
        placeHolder: 'Pick the workspace whose `vnext.config.json` `domain` will be used.',
        ignoreFocusOut: true,
      },
    );
    return pick?.root;
  }

  private async addLocalEnvironment(): Promise<void> {
    const service = this.localRuntime;
    if (!service) return;

    const root = await this.pickWorkspaceRoot();
    if (!root) {
      void vscode.window.showWarningMessage(
        'Open a vNext workspace before adding a local runtime environment.',
      );
      return;
    }

    const domain = (await this.resolveWorkspaceDomain?.(root))?.trim() ?? '';
    if (domain.length === 0) {
      void vscode.window.showErrorMessage(
        'Local runtime needs a domain. Add a `domain` field to vnext.config.json first.',
      );
      return;
    }

    const preflight = await service.detectPreflight();
    if (!preflight.ok) {
      const missing = preflight.issues
        .map((i) => (i.problem === 'not-running' ? `${i.tool} (installed but not running)` : i.tool))
        .join(', ');
      const notRunning = preflight.issues.some((i) => i.problem === 'not-running');
      const message = notRunning
        ? `${missing}. Start it and retry.`
        : `Local runtime needs: ${missing}.`;
      const action = await vscode.window.showErrorMessage(
        message,
        ...(notRunning ? ['Retry'] : []),
        'Open Install Docs',
      );
      if (action === 'Retry') {
        await this.addLocalEnvironment();
      } else if (action === 'Open Install Docs') {
        void vscode.env.openExternal(vscode.Uri.parse(preflight.issues[0]?.helpUrl ?? 'https://orbstack.dev'));
      }
      return;
    }

    const suggested = await service.suggestPortOffset(root.folderPath);
    const offsetInput = await vscode.window.showInputBox({
      title: 'Add Local Environment',
      prompt: 'Port offset (multiples of 10). The API will listen on 4201 + offset.',
      value: suggested === null ? '' : String(suggested),
      placeHolder: suggested === null ? 'No free offset found below 200 — enter one' : undefined,
      validateInput: (v) => {
        const parsed = Number.parseInt(v.trim(), 10);
        if (!Number.isFinite(parsed)) return 'Enter a whole number';
        return LocalRuntimeService.isValidPortOffset(parsed)
          ? null
          : 'Offset must be zero or a positive multiple of 10';
      },
      ignoreFocusOut: true,
    });
    if (offsetInput === undefined) return;
    const portOffset = Number.parseInt(offsetInput.trim(), 10);

    const name = await vscode.window.showInputBox({
      title: 'Add Local Environment',
      prompt: 'Environment name',
      value: `Local (${domain})`,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
      ignoreFocusOut: true,
    });
    if (!name) return;

    let result: Awaited<ReturnType<LocalRuntimeService['provision']>> | undefined;
    try {
      result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Provisioning local runtime for "${domain}"`,
          cancellable: true,
        },
        (progress, token) =>
          service.provision({ workspacePath: root.folderPath, domain, portOffset }, progress, token),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const action = await vscode.window.showErrorMessage(
        `Local runtime provisioning failed: ${message}`,
        'Show Output',
      );
      if (action === 'Show Output') this.showOutput?.();
      return;
    }
    if (!result) return;

    await this.settingsService.addEnvironment(
      name.trim(),
      result.baseUrl,
      result.dbName,
      result.binding,
    );
    await this.runDomainAdd(domain, result.baseUrl, result.dbName, name.trim(), result.binding);

    const message = result.healthy
      ? `Local runtime for domain "${domain}" is running at ${result.baseUrl}`
      : `Local runtime for domain "${domain}" started at ${result.baseUrl}, but /health did not respond yet.`;
    const action = await vscode.window.showInformationMessage(message, 'Show Logs', 'Show Output');
    if (action === 'Show Logs') {
      await this.showLogs(result.binding);
    } else if (action === 'Show Output') {
      this.showOutput?.();
    }
  }
```

Add two optional constructor parameters used above — `showOutput` (reveals the Output channel)
and `runTerminal` (used by `showLogs` in Step 3):

```ts
    private readonly showOutput?: () => void,
    private readonly runTerminal?: (command: string, cwd: string) => void,
```

Widen `runDomainAdd` to forward the discovered connection details when a binding is present:

```ts
  private async runDomainAdd(
    cliDomain: string,
    baseUrl: string,
    dbName: string,
    envLabel: string,
    binding?: LocalRuntimeBinding,
  ): Promise<void> {
    if (!this.domainAdd) return;
    try {
      const extra = binding && this.localRuntime
        ? this.localRuntime.buildDomainAddArgs(binding, dbName)
        : { domainName: cliDomain, apiBaseUrl: baseUrl, dbName };
      const result = await this.domainAdd(extra);
      // …existing success / failure notification logic, unchanged…
```

> Keep the rest of `runDomainAdd`'s body exactly as it is today in every respect **except**
> the one fixed below. A non-zero exit stays a warning: the domain may simply already be
> registered, which must not fail the flow.

**Amendment found during Task 10 — a second secret-exposure path.** `runDomainAdd`'s failure
branch surfaces `result.stderr.trim() || result.stdout.trim()` verbatim in a VS Code warning
toast. Once this task starts passing `--DB_PASSWORD` through, a `wf` usage error that echoes its
own invocation would print that password into the UI. This path does **not** go through
`process-runner.ts`, so the redaction added in Task 11 does not cover it. Apply
`redactSecrets(...)` (exported from `apps/extension/src/tools/local-runtime/process-runner.ts`)
to that message before showing it.

Also noted and deliberately **not** fixed: passing `--DB_PASSWORD` on an argv puts it in the host
process table, visible to `ps` for the lifetime of the call. That is inherent to any exec-based
CLI that takes a secret as a flag and cannot be fixed here — it would need an env-var or stdin
channel on the `wf` side. It is acceptable in this case because the value is `postgres`, the
well-known local-development credential published in the runtime repo's own compose file.

Also widen the `DomainAddFn` type at the top of the file:

```ts
export type DomainAddFn = (params: {
  domainName: string;
  apiBaseUrl: string;
  dbName: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  dbPassword?: string;
  useDocker?: boolean;
  dockerPostgresContainer?: string;
}) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
```

- [ ] **Step 3: Add the lifecycle command handlers**

Add to `EnvironmentsProvider`:

```ts
  private async withEnvironment(
    envId: string,
  ): Promise<{ env: RuntimeEnvironment; binding: LocalRuntimeBinding } | undefined> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === envId);
    if (!env?.local || env.kind !== 'local-docker') return undefined;
    return { env, binding: env.local };
  }

  /** Shared runner for the simple lifecycle verbs. */
  private async runLifecycle(
    envId: string,
    title: string,
    run: (
      binding: LocalRuntimeBinding,
      progress: vscode.Progress<{ message?: string }>,
      token: vscode.CancellationToken,
    ) => Promise<void>,
  ): Promise<void> {
    const found = await this.withEnvironment(envId);
    if (!found || !this.localRuntime) return;
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title, cancellable: true },
        (progress, token) => run(found.binding, progress, token),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const action = await vscode.window.showErrorMessage(`${title} failed: ${message}`, 'Show Output');
      if (action === 'Show Output') this.showOutput?.();
      return;
    }
    this.containerStates.delete(envId);
    this._onDidChangeTreeData.fire(undefined);
  }

  async startEnvironment(envId: string): Promise<void> {
    const found = await this.withEnvironment(envId);
    if (!found || !this.localRuntime) return;
    if (!(await this.localRuntime.isProvisioned(found.binding))) {
      const choice = await vscode.window.showWarningMessage(
        'This runtime is not provisioned yet. Provision it now?',
        { modal: true },
        'Provision',
      );
      if (choice !== 'Provision') return;
      await this.runLifecycle(envId, 'Provisioning local runtime', (binding, progress, token) =>
        this.localRuntime!.provision(
          {
            workspacePath: binding.workspacePath,
            domain: binding.domain,
            portOffset: binding.portOffset,
          },
          progress,
          token,
        ).then(() => undefined),
      );
      return;
    }
    await this.runLifecycle(envId, `Starting ${found.binding.domain}`, (b, p, t) =>
      this.localRuntime!.start(b, p, t),
    );
  }

  async stopEnvironment(envId: string): Promise<void> {
    const found = await this.withEnvironment(envId);
    if (!found) return;
    await this.runLifecycle(envId, `Stopping ${found.binding.domain}`, (b, p, t) =>
      this.localRuntime!.stop(b, p, t),
    );
  }

  async restartEnvironment(envId: string): Promise<void> {
    const found = await this.withEnvironment(envId);
    if (!found) return;
    await this.runLifecycle(envId, `Restarting ${found.binding.domain}`, (b, p, t) =>
      this.localRuntime!.restart(b, p, t),
    );
  }

  async updateRuntime(envId: string): Promise<void> {
    const found = await this.withEnvironment(envId);
    if (!found) return;
    await this.runLifecycle(envId, 'Updating the runtime clone', (b, p, t) =>
      this.localRuntime!.updateRuntime(b, p, t),
    );
    void vscode.window.showInformationMessage(
      'Runtime updated. Restart the environment to apply changes.',
    );
  }

  async showLogs(binding: LocalRuntimeBinding): Promise<void> {
    this.runTerminal?.(`make logs-vnext DOMAIN=${binding.domain}`, binding.runtimePath);
  }

  async showLogsForEnvironment(envId: string): Promise<void> {
    const found = await this.withEnvironment(envId);
    if (found) await this.showLogs(found.binding);
  }

  async openRuntimeFolder(envId: string): Promise<void> {
    const found = await this.withEnvironment(envId);
    if (!found) return;
    await vscode.commands.executeCommand(
      'revealFileInOS',
      vscode.Uri.file(found.binding.runtimePath),
    );
  }

  async revealPorts(envId: string): Promise<void> {
    const found = await this.withEnvironment(envId);
    if (!found) return;
    const { ports } = found.binding;
    const items = [
      { label: 'Orchestration API', port: ports.app },
      { label: 'Execution', port: ports.execution },
      { label: 'Worker Inbox', port: ports.inbox },
      { label: 'Worker Outbox', port: ports.outbox },
      { label: 'Init', port: ports.init },
    ].map((entry) => ({
      label: entry.label,
      description: `http://localhost:${entry.port}`,
      url: `http://localhost:${entry.port}`,
    }));
    const pick = await vscode.window.showQuickPick(items, {
      title: `Ports for "${found.binding.domain}"`,
      placeHolder: 'Select a port to copy its URL',
    });
    if (!pick) return;
    await vscode.env.clipboard.writeText(pick.url);
    void vscode.window.showInformationMessage(`Copied ${pick.url}`);
  }
```

- [ ] **Step 4: Teardown on delete for managed environments**

Replace `deleteEnvironment`:

```ts
  async deleteEnvironment(envId: string): Promise<void> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === envId);
    if (!env) return;

    const isManaged = env.kind === 'local-docker' && env.local !== undefined;
    const detail = isManaged
      ? 'This stops the containers and removes the generated domain configuration. The database and the runtime clone are kept.'
      : undefined;

    const confirm = await vscode.window.showWarningMessage(
      `Delete environment "${env.name}"?`,
      { modal: true, detail },
      'Delete',
    );
    if (confirm !== 'Delete') return;

    if (isManaged && this.localRuntime && env.local) {
      const binding = env.local;
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Tearing down ${binding.domain}`,
            cancellable: true,
          },
          (progress, token) => this.localRuntime!.teardown(binding, progress, token),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const action = await vscode.window.showWarningMessage(
          `Teardown reported a problem: ${message}. The environment entry will still be removed.`,
          'Show Output',
        );
        if (action === 'Show Output') this.showOutput?.();
      }
    }

    this.containerStates.delete(envId);
    await this.settingsService.removeEnvironment(envId);
  }
```

- [ ] **Step 5: Reflect container state in the tree**

Add the cache field next to `private envConfig`:

```ts
  private readonly containerStates = new Map<string, ContainerState>();
```

Replace `getTreeItem` with the version below. It keeps the existing health behaviour for remote
environments and layers container state on top for managed ones:

```ts
  async getTreeItem(element: string): Promise<vscode.TreeItem> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === element);
    if (!env) {
      return new vscode.TreeItem('Unknown');
    }

    const isActive = config.activeEnvironmentId === env.id;
    const health = isActive ? this.healthMonitor.getHealth() : undefined;
    const isManaged = env.kind === 'local-docker' && env.local !== undefined;

    let containerState: ContainerState | undefined;
    if (isManaged && this.localRuntime && env.local) {
      containerState = this.containerStates.get(env.id);
      if (containerState === undefined) {
        containerState = await this.localRuntime.getContainerState(env.local);
        this.containerStates.set(env.id, containerState);
      }
    }

    const item = new vscode.TreeItem(env.name, vscode.TreeItemCollapsibleState.None);
    item.description = env.baseUrl;
    item.contextValue = isManaged ? 'environment-local' : 'environment';
    item.tooltip = this.buildTooltip(env, isActive, health, containerState);
    item.iconPath = isManaged
      ? this.getManagedIcon(containerState, isActive, health)
      : this.getHealthIcon(isActive, health);

    if (!isActive) {
      item.command = {
        command: 'vnextForge.tools.setActiveEnvironment',
        title: 'Set Active',
        arguments: [element],
      };
    }

    return item;
  }

  /**
   * Container state drives the icon; health stays in the tooltip. That keeps
   * "containers up but /health failing" visible instead of collapsing the two
   * signals into one indicator.
   */
  private getManagedIcon(
    state: ContainerState | undefined,
    isActive: boolean,
    health?: HealthStatus,
  ): vscode.ThemeIcon {
    if (state === 'running') {
      if (isActive && health === 'unhealthy') {
        return new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconQueued'));
      }
      return new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconPassed'));
    }
    if (state === 'stopped') return new vscode.ThemeIcon('debug-stop');
    return new vscode.ThemeIcon('circle-outline');
  }
```

Replace `buildTooltip` so it reports the managed details:

```ts
  private buildTooltip(
    env: RuntimeEnvironment,
    isActive: boolean,
    health?: HealthStatus,
    containerState?: ContainerState,
  ): string {
    const lines = [
      `Name: ${env.name}`,
      `URL: ${env.baseUrl}`,
      `Status: ${isActive ? 'Active' : 'Inactive'}`,
    ];
    if (env.dbName) {
      lines.push(`DB Name: ${env.dbName}`);
    }
    if (env.kind === 'local-docker' && env.local) {
      const p = env.local.ports;
      lines.push(
        `Managed local runtime (domain: ${env.local.domain}, offset: ${env.local.portOffset})`,
        `Containers: ${containerState ?? 'unknown'}`,
        `Ports — app ${p.app}, execution ${p.execution}, inbox ${p.inbox}, outbox ${p.outbox}, init ${p.init}`,
      );
    }
    if (health) {
      lines.push(`Health: ${health}`);
    }
    return lines.join('\n');
  }
```

Finally, clear the state cache whenever environments change — inside the constructor's
`settingsService.onDidChangeEnvironments` handler, add `this.containerStates.clear();` next to
`this.envConfig = undefined;`.

- [ ] **Step 6: Verify the host build compiles**

Run: `pnpm --filter vnext-forge-studio build:host`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/src/tools/providers/environments-provider.ts
git commit -m "feat(environments): local runtime add flow and lifecycle actions"
```

---

### Task 17: Commands, menus and wiring

**Files:**
- Modify: `apps/extension/package.json` (`contributes.commands`, `contributes.menus`)
- Modify: `apps/extension/src/extension.ts:214-260`

- [ ] **Step 1: Contribute the commands**

In `apps/extension/package.json`, add to `contributes.commands` (next to the existing
`vnextForge.tools.*` environment entries):

```json
{
  "command": "vnextForge.tools.startEnvironment",
  "title": "Start Local Runtime",
  "category": "vNext Forge",
  "icon": "$(play)"
},
{
  "command": "vnextForge.tools.stopEnvironment",
  "title": "Stop Local Runtime",
  "category": "vNext Forge",
  "icon": "$(debug-stop)"
},
{
  "command": "vnextForge.tools.restartEnvironment",
  "title": "Restart Local Runtime",
  "category": "vNext Forge",
  "icon": "$(debug-restart)"
},
{
  "command": "vnextForge.tools.showEnvironmentLogs",
  "title": "Show Local Runtime Logs",
  "category": "vNext Forge",
  "icon": "$(output)"
},
{
  "command": "vnextForge.tools.openRuntimeFolder",
  "title": "Open Runtime Folder",
  "category": "vNext Forge"
},
{
  "command": "vnextForge.tools.revealEnvironmentPorts",
  "title": "Reveal Ports",
  "category": "vNext Forge"
},
{
  "command": "vnextForge.tools.updateRuntime",
  "title": "Update Runtime",
  "category": "vNext Forge"
}
```

- [ ] **Step 2: Gate them on managed environments**

In `contributes.menus`, add to `view/item/context` (alongside the existing
`viewItem == environment` entries):

```json
{
  "command": "vnextForge.tools.startEnvironment",
  "when": "view == vnextForge.tools.environments && viewItem == environment-local",
  "group": "inline@1"
},
{
  "command": "vnextForge.tools.stopEnvironment",
  "when": "view == vnextForge.tools.environments && viewItem == environment-local",
  "group": "inline@2"
},
{
  "command": "vnextForge.tools.restartEnvironment",
  "when": "view == vnextForge.tools.environments && viewItem == environment-local",
  "group": "1_lifecycle@1"
},
{
  "command": "vnextForge.tools.showEnvironmentLogs",
  "when": "view == vnextForge.tools.environments && viewItem == environment-local",
  "group": "2_diagnostics@1"
},
{
  "command": "vnextForge.tools.openRuntimeFolder",
  "when": "view == vnextForge.tools.environments && viewItem == environment-local",
  "group": "2_diagnostics@2"
},
{
  "command": "vnextForge.tools.revealEnvironmentPorts",
  "when": "view == vnextForge.tools.environments && viewItem == environment-local",
  "group": "2_diagnostics@3"
},
{
  "command": "vnextForge.tools.updateRuntime",
  "when": "view == vnextForge.tools.environments && viewItem == environment-local",
  "group": "3_maintenance@1"
}
```

The existing `editEnvironment` / `deleteEnvironment` / `setActiveEnvironment` entries are
scoped to `viewItem == environment`, so duplicate each of those three with
`viewItem == environment-local` in the same groups — managed environments need them too.

- [ ] **Step 3: Wire the service in `extension.ts`**

In `extension.ts`, before `const environmentsProvider = new EnvironmentsProvider(`, add:

```ts
  const localRuntimeService = new LocalRuntimeService(outputChannel);
```

with the import:

```ts
import { LocalRuntimeService } from './tools/local-runtime/local-runtime.service.js';
```

Extend the `EnvironmentsProvider` construction with the three new arguments:

```ts
  const environmentsProvider = new EnvironmentsProvider(
    forgeToolsSettings,
    healthMonitor,
    services.cliService
      ? (params) => services.cliService!.domainAdd(params)
      : undefined,
    detector,
    async (root) => {
      const config = await services.workspaceService.getConfig(root.folderPath);
      return config.domain ?? '';
    },
    localRuntimeService,
    () => outputChannel.show(true),
    (command, cwd) => forgeTerminal.run(command, { cwd }),
  );
```

- [ ] **Step 4: Register the command handlers**

In `extension.ts`, alongside the existing `vnextForge.tools.*` environment command
registrations, add:

```ts
    vscode.commands.registerCommand(
      'vnextForge.tools.startEnvironment',
      safeAsync((id) => environmentsProvider.startEnvironment(id as string)),
    ),
    vscode.commands.registerCommand(
      'vnextForge.tools.stopEnvironment',
      safeAsync((id) => environmentsProvider.stopEnvironment(id as string)),
    ),
    vscode.commands.registerCommand(
      'vnextForge.tools.restartEnvironment',
      safeAsync((id) => environmentsProvider.restartEnvironment(id as string)),
    ),
    vscode.commands.registerCommand(
      'vnextForge.tools.showEnvironmentLogs',
      safeAsync((id) => environmentsProvider.showLogsForEnvironment(id as string)),
    ),
    vscode.commands.registerCommand(
      'vnextForge.tools.openRuntimeFolder',
      safeAsync((id) => environmentsProvider.openRuntimeFolder(id as string)),
    ),
    vscode.commands.registerCommand(
      'vnextForge.tools.revealEnvironmentPorts',
      safeAsync((id) => environmentsProvider.revealPorts(id as string)),
    ),
    vscode.commands.registerCommand(
      'vnextForge.tools.updateRuntime',
      safeAsync((id) => environmentsProvider.updateRuntime(id as string)),
    ),
```

> Check the surrounding registrations for the exact `safeAsync` signature in use and match it.
> If `outputChannel` is not in scope at that point in `activate`, use the same channel the
> `baseLogger` writes to — grep for `createOutputChannel` in `extension.ts`.

- [ ] **Step 5: Build the whole extension**

Run: `pnpm --filter vnext-forge-studio build`
Expected: exit 0 for both `build:host` and `build:webview`.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/package.json apps/extension/src/extension.ts
git commit -m "feat(environments): contribute local runtime commands and wire the service"
```

---

### Task 18: Full verification

**Files:** none modified — this task only runs and records.

- [ ] **Step 1: Run every automated suite**

```bash
pnpm --filter @vnext-forge-studio/services-core test
```
Expected: PASS — 18 pre-existing + ~42 new.

```bash
cd packages/designer-ui && npx vitest run
```
Expected: PASS — 337 pre-existing + 9 new.

```bash
pnpm --filter @vnext-forge-studio/services-core build
pnpm --filter vnext-forge-studio build
```
Expected: exit 0 for all.

- [ ] **Step 2: Lint only what this branch touched**

```bash
npx eslint packages/services-core/src/services/local-runtime apps/extension/src/tools/local-runtime packages/designer-ui/src/modules/quick-run/pseudo-ui
```
Expected: no errors on the new files. Per-package `eslint .` is pre-existing red in this repo —
do not treat unrelated findings as regressions.

- [ ] **Step 3: Manual pass in the Extension Development Host**

Press F5 (or run the extension's debug config) with a real vNext workspace open, then walk:

1. Forge Tools → Environment → **Add Environment** → *Local (managed Docker runtime)*.
2. Confirm the offset input arrives pre-filled and that entering `5` is rejected with
   "Offset must be zero or a positive multiple of 10".
3. Let provisioning run. Confirm the Output channel streams `git`/`make` output and that no
   `--DB_PASSWORD` value appears in it (only `***`).
4. Confirm `.gitignore` gained `.vnext-runtime/` and that `git status` is clean of the clone.
5. Confirm the success notification shows `http://localhost:<4201+offset>`.
6. Confirm `wf domain list` includes the domain with the right API base URL and DB name.
7. Stop → icon turns to the stopped indicator; Start → back to running; Restart works.
8. Show Logs opens a terminal tailing `make logs-vnext`; Open Runtime Folder reveals the clone;
   Reveal Ports copies a URL.
9. Run **Add Environment** again for the same domain and confirm it reuses the existing offset
   rather than shifting ports.
10. Delete → confirm the modal spells out the teardown, then confirm `domains/<domain>/` is gone
    while the clone and the database remain.
11. Quick Run: with Global Headers configured, open a view containing an `x-lov` lookup and
    confirm in the runtime logs (or via a header-echoing function) that the global headers
    arrive on the function call.

- [ ] **Step 4: Record the outcome**

Report which of the 11 manual steps passed. Any that fail become follow-up fixes on this branch
before it is considered done — do not report completion with unverified steps.

---

## Self-Review

**Spec coverage.** Part 1 → Tasks 1–2. Part 2: module layout → Tasks 3–9, 11–15; `wf domain add`
widening → Task 10; data model → Task 13; add flow → Tasks 14, 16; collision defence →
`isInfraRunning` (Task 14) and `suggestPortOffset` (Task 14); container runtime detection →
Tasks 7, 11; lifecycle actions → Tasks 15–17; error handling → `step()` in Task 14 plus the
Show Output actions in Task 16; tests → Tasks 3–9 and 18. Deferred items are absent by design.

**Known deviation from the spec.** The spec lists `preflight.ts` taking `{ git, make, runtime }`;
the implementation adds `daemonReachable` to that input, because the "installed but not running"
verdict cannot be reached without it. The spec's intent is preserved.
