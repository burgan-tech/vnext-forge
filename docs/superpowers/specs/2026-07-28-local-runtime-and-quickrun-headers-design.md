# Design — Managed local runtime environments + QuickRunner global header propagation

Date: 2026-07-28
Branch: `f/local-runtime-and-quickrun-headers`

Two independent deliverables land on this branch as separate commits:

1. **Fix** — QuickRunner does not forward Global Headers on function calls made during
   view render (`x-lov` lookups) or on function/flow-start dispatches.
2. **Feature** — the Environment panel can provision, start, stop and tear down a
   local Docker runtime, so a developer new to vNext gets a one-run experience
   instead of "clone the runtime repo, install the CLI, register an environment".

---

## Part 1 — QuickRunner: forward Global Headers on function calls

### Problem

QuickRunner is the client's mini-simulation surface. Global Headers entered in the
QuickRunner UI must ride along on **every** request it makes to the engine, because
a real client would send them on every request.

Today they do not. In
`packages/designer-ui/src/modules/quick-run/pseudo-ui/createQuickRunPseudoDelegate.ts`
three call sites pass only `params.getSessionHeaders()`:

| Call site | What it does | Line (pre-change) |
|---|---|---|
| `requestData` | LOV / lookup resolution during view render (`x-lov`) → `QuickRunApi.executeFunction` | ~247 |
| `onAction` → `dispatch` → `parsed.kind === 'fn'` | function dispatch from a Button → `executeFunction` | ~540 |
| `onAction` → `dispatch` → `parsed.kind === 'flow-start'` | starts a new instance → `QuickRunApi.startInstance` | ~459 |

`getSessionHeaders` is wired in `InstanceDashboard.tsx` as
`() => sessionHeadersRef.current` — session headers only, no globals.

By contrast `firePseudoUiTransition.ts` merges correctly:
`globalHeaders → sessionHeaders → per-transition headers` (lowest → highest priority),
reading globals from `bucketConfig.globalHeaders`. So transitions carry global headers
and function calls do not — an inconsistency, not a deliberate design.

### Change

Extract the merge into one shared helper and use it everywhere:

`packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.ts`

```ts
export function mergeQuickRunHeaders(
  bucketConfig: WorkflowBucketConfig | null | undefined,
  sessionHeaders: Record<string, string> | undefined,
  extra?: Record<string, string>,
): Record<string, string>;
// → { ...bucketConfig?.globalHeaders, ...sessionHeaders, ...extra }
```

- `firePseudoUiTransition` is refactored to call it with
  `extra = perTransitionHeaders`. Its observable behaviour does not change.
- `createQuickRunPseudoDelegate` gains a local
  `resolveHeaders = () => mergeQuickRunHeaders(params.getBucketConfig(), params.getSessionHeaders())`
  and uses it at all three call sites above.

Precedence stays exactly as it is today: **session headers override global headers**;
per-transition headers (only reachable from the manual TransitionDialog path) override both.

### Out of scope

`InstanceDashboard`'s own fetches already merge globals (`{ ...globalHeaders, ...sessionHeaders }`)
and are not touched.

### Tests (`packages/designer-ui`, vitest)

- `mergeQuickRunHeaders.vitest.test.ts` — global-only, session-only, both, session-wins-on-conflict,
  `extra`-wins-over-both, null/undefined `bucketConfig`.
- `createQuickRunPseudoDelegate.vitest.test.ts` (new) — with `QuickRunApi` mocked, assert the
  `headers` argument received by `executeFunction` / `startInstance` for:
  `requestData` (LOV), `dispatch` + function URN, `dispatch` + flow-start URN. Each asserts
  globals are present and that a session header of the same name wins.
- Existing `firePseudoUiTransition.vitest.test.ts` must stay green unchanged — it is the
  regression lock for the refactor.

---

## Part 2 — Managed local runtime environments

### Goal

From the Forge Tools **Environment** panel, "Add Environment" can provision a complete
local runtime: clone `github.com/burgan-tech/vnext-runtime`, allocate a free port offset,
generate the domain compose configuration, start Docker, discover the resulting API URL and
database name, register the domain with the Workflow CLI, and persist the environment —
without the developer running a single command by hand.

Remote (real) environments stay fully supported; the flow simply asks which kind you want.

### Decisions taken during design

| Decision | Choice | Why |
|---|---|---|
| Clone location | `<workspace>/.vnext-runtime`, added to the workspace `.gitignore` | Requested: visible in the workspace, user can drop to `make` by hand. Cost: cross-workspace port/infra collisions must be defended against explicitly (see below). |
| Port offset | Auto-computed, shown pre-filled in an input box, user may override | One-keystroke happy path, full control when needed. |
| Long-running steps | `spawn` + live output to the `vnext-forge-studio` Output channel + cancellable `withProgress` | Exit codes are needed to chain steps and to auto-register the CLI domain afterwards. A raw terminal cannot give that reliably. |
| Clone strategy | `git clone --depth 1` of the default branch, plus an explicit **Update Runtime** action (`git pull --ff-only`) | Fast, and version control stays with the user. |
| Code placement | Pure logic in `packages/services-core/src/services/local-runtime/` (**not** registered in the method registry); VS Code orchestration in `apps/extension/src/tools/local-runtime/` | `apps/extension` has no test runner, so the fallible logic must live where vitest runs. Skipping registry registration keeps "git clone + docker up" off the `apps/server` HTTP surface and avoids the 5-step `rpc-method-policy` checklist. |
| Action set (v1) | Start / Stop / Restart + state indicator, Show Logs, Open Runtime Folder, Reveal Ports, Update Runtime, Delete-with-teardown | Agreed scope. |
| `db-reset` | Deferred | Destructive; not needed for the one-run goal. |

### Runtime repo contract (verified against the repo)

`vnext-runtime` Makefile + `vnext/docker/create-domain.sh`:

- `make setup` — creates `vnext/docker/.env` (infra) and the `templates/` + `domains/`
  directories, creates the `vnext-development` network. Idempotent.
- `make up-infra` — shared infrastructure: `vnext-postgres` (**fixed** `5432`,
  `postgres`/`postgres`), `vnext-redis`, `vnext-vault`, OpenObserve, Dapr placement/scheduler.
  **Not** affected by the port offset.
- `make create-domain DOMAIN=<d> PORT_OFFSET=<n>` — renders `templates/*` into
  `domains/<d>/` (`.env`, `.env.orchestration`, …, `appsettings.*.json`).
- `make db-create DOMAIN=<d>` — creates the domain database; handles "already exists".
- `make up-vnext DOMAIN=<d>` — `compose -p vnext-<d> --env-file domains/<d>/.env --profile vnext up -d`.
  It already starts infra itself if `vnext-postgres` is not running.
- `make down-vnext | restart-vnext | status-vnext | logs-vnext DOMAIN=<d>`, `make health DOMAIN=<d>`.
- Container names are domain-suffixed: `vnext-app-<domain>`, `vnext-execution-app-<domain>`, …

Port math (`create-domain.sh`):

```
VNEXT_APP_PORT       = 4201 + offset
VNEXT_EXECUTION_PORT = 4202 + offset
VNEXT_INBOX_PORT     = 4203 + offset
VNEXT_OUTBOX_PORT    = 4204 + offset
VNEXT_INIT_PORT      = 3005 + offset
DAPR_* ports         = base + (offset * 100)
```

Therefore **the offset must be a multiple of 10**: with offset 1, the new domain's app port
(4202) collides with offset 0's execution port.

Workflow CLI (`wf domain add <name>`) accepts `--API_BASE_URL --API_VERSION --DB_HOST
--DB_PORT --DB_NAME --DB_USER --DB_PASSWORD --AUTO_DISCOVER --USE_DOCKER
--DOCKER_POSTGRES_CONTAINER --DEBUG_MODE`.

### Module layout

`packages/services-core/src/services/local-runtime/` — pure, no `vscode` import:

| File | Responsibility |
|---|---|
| `port-math.ts` | `computeDomainPorts(offset)` — mirror of `create-domain.sh`. Locked by a table test. |
| `port-allocator.ts` | `findFreePortOffset({ usedOffsets, probe, maxOffset })` — walks 0, 10, 20, … and rejects an offset if **any** of its five host ports is taken. `probe` is injected. `maxOffset` defaults to **200** (21 candidate domains); exhaustion returns `null` and the caller surfaces *"No free port offset found below 200. Stop an unused runtime or enter an offset manually."* with the offset input box still open. |
| `domain-env.ts` | `parseDomainEnv(content)` → offset + the five ports, read back from an existing `domains/<d>/.env`. |
| `db-name.ts` | `normalizeDbName(domain)` (mirror of `create-domain.sh`: non-alphanumeric → `_`, first character upper-cased → `vNext_Core`) and `extractDbNameFromAppSettings(content)` (`Database=([^;]+)`). |
| `commands.ts` | `cloneArgv(url, dest)`, `makeArgv(target, { domain, portOffset })`, `dockerPsArgv(containerName)`, `wfDomainAddArgv(params)`. Returns argv arrays — never a shell string. |
| `preflight.ts` | `evaluatePreflight({ git, make, runtime })` → missing tools + install URLs, and the "installed but daemon not running" case. |
| `container-runtime.ts` | `detectContainerRuntime(lookup, composeProbe)` → `ContainerRuntimeInfo` or a missing-runtime result. See below. |
| `index.ts` | Barrel. |

`apps/extension/src/tools/local-runtime/` — VS Code side:

| File | Responsibility |
|---|---|
| `local-runtime.service.ts` | The orchestrator: `provision`, `start`, `stop`, `restart`, `teardown`, `updateRuntime`, `getContainerState`, `detectPreflight`, `probePort`. Chains steps on exit codes, reports through `withProgress`. |
| `process-runner.ts` | `runStreaming(file, argv, { cwd, onLine, token })` → `{ exitCode }`. Uses `buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST)` like `cli.service.ts`. Cancellation → `SIGTERM`. Redacts `--DB_PASSWORD <v>` in emitted lines. |
| `gitignore-writer.ts` | Idempotently ensures `.vnext-runtime/` is in the workspace `.gitignore`. |
| `tool-lookup.ts` | Implements `ToolLookup` for the pure detector: `PATH` first, then the well-known-location fallback (see below). |

### Container runtime detection (docker / OrbStack / Docker Desktop / Colima / podman)

**OrbStack is not a third runtime.** It ships a Docker-compatible daemon plus the `docker`
CLI; `orb` is only OrbStack's own management binary. Verified on a dev machine: `docker` and
`orb` both resolve to `/usr/local/bin`, and `docker context ls` shows `orbstack *` as the
active context. The same holds for Docker Desktop, Colima and Rancher Desktop — they differ
only in the daemon behind the socket, which is invisible to us. The runtime repo's Makefile
reaches the same conclusion (`orb` present → `CONTAINER_RUNTIME = docker`).

So the real axis is binary: **docker-CLI vs podman-CLI**. The third name is a cosmetic label.

```ts
export type ToolLookup = (bin: string) => string | null;  // absolute path, or null

export interface ContainerRuntimeInfo {
  containerCli: { bin: 'docker' | 'podman'; path: string };
  composeArgv: string[];                     // ['docker','compose'] | ['docker-compose']
                                             // | ['podman','compose'] | ['podman-compose']
  flavor: 'orbstack' | 'docker' | 'podman';  // label only — drives preflight wording
}
```

Detection order **mirrors the Makefile exactly** so Forge and `make` never disagree, with
three deliberate hardenings:

1. **`orb` alone does not imply docker.** The Makefile maps `orb` → `docker` unconditionally;
   if OrbStack is installed without its CLI helpers linked, `check-runtime` prints success and
   the next command fails. Forge falls through to podman / none instead.
2. **PATH fallback.** `PATH` is in `DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST`, so we inherit the
   extension host's PATH — but on macOS a VS Code launched from Dock/Finder gets launchd's
   PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), which excludes `/usr/local/bin` and
   `/opt/homebrew/bin` where docker, orb and docker-compose usually live. VS Code normally
   repairs this by resolving the login shell environment, but that can be disabled
   (`terminal.integrated.inheritEnv: false`) or fail on unusual shell configs — producing a
   false "Docker not found". Before declaring a binary missing, `lookup` therefore checks
   well-known locations: `/usr/local/bin`, `/opt/homebrew/bin`, `/usr/bin`, `~/.docker/bin`,
   `~/.rd/bin`, and on Windows `%ProgramFiles%\Docker\Docker\resources\bin`. When found there,
   the **absolute path** is used to spawn.
3. **Installed ≠ running.** Preflight also runs `<cli> info --format {{.ServerVersion}}` and
   treats a non-zero exit as its own state, so the message becomes *"Docker is installed but
   not running. Start OrbStack / Docker Desktop and retry."* instead of "not found". This is
   the most common newcomer failure and deserves its own wording.

**Why container-CLI `ps` and not compose for state detection:** `<cli> ps --filter
name=^vnext-app-<domain>$ --format {{.Status}}` uses two flags podman implements
docker-compatibly, whereas compose-level `--format json` is not available in
`podman-compose`. The regex is anchored because an unanchored `name=core` filter would also
match `vnext-app-core2`.

**We never pass the detected runtime to `make`.** The Makefile does its own detection;
overriding it would only create a second opinion. Forge's detection feeds exactly two things:
preflight wording, and Forge's own `ps` calls. The result is resolved once per session and
re-detected if a spawn fails with `ENOENT`.

> Unverified: podman was not installed on the machine used during design, so the podman branch
> was not executed. `podman ps` documents `--filter name=<regex>` and `--format`, but the first
> person to run the podman path should confirm.

`EnvironmentsProvider` receives the service by injection (same pattern as the existing
`domainAdd` injection) so the tree logic stays separable from orchestration.

### Data model

`apps/extension/src/tools/forge-tools-settings.ts`:

```ts
export type EnvironmentKind = 'remote' | 'local-docker';

export interface LocalRuntimeBinding {
  domain: string;         // from vnext.config.json
  portOffset: number;
  runtimePath: string;    // absolute <workspace>/.vnext-runtime
  workspacePath: string;  // owning workspace root
  ports: { app: number; execution: number; inbox: number; outbox: number; init: number };
}

export interface RuntimeEnvironment {
  id: string;
  name: string;
  baseUrl: string;
  dbName?: string;
  kind?: EnvironmentKind;       // undefined → 'remote' (backward compatible)
  local?: LocalRuntimeBinding;  // only when kind === 'local-docker'
}
```

`environments.json` stays at `version: 1`. `parseEnvironments` validates the new fields and,
if `local` is missing or malformed on a `local-docker` entry, **downgrades the entry to
`remote`** rather than dropping it — consistent with the file's existing "skip what you
cannot trust" discipline. Existing files load unchanged.

`dbName` now has two sources:

- **local-docker** — discovered from disk after `create-domain` (see step 4 below). Never asked.
- **remote** — today's behaviour, unchanged (user input, default `vNext_<domain>`).

### Add Environment flow

`vnextForge.tools.addEnvironment` starts with a QuickPick:

- *Local (managed Docker runtime)* — "Forge clones the runtime, allocates ports, and starts Docker for you."
- *Remote / existing* — "Connect to a vNext platform that is already running."

**Remote branch: byte-for-byte the current flow** (name → baseUrl → workspace domain →
dbName → `wf domain add`).

**Local branch.** Prompts, in order:

1. Workspace pick (skipped when there is exactly one root) → read `domain` from
   `vnext.config.json` via `services.workspaceService.getConfig`. If there is no domain,
   abort with: *"Local runtime needs a domain. Add a `domain` field to vnext.config.json first."*
2. Preflight: resolve `git`, `make` and the container runtime (see *Container runtime
   detection*). If anything is missing, one notification lists all of it with install links and
   the flow stops. A present-but-stopped daemon gets its own message and a **Retry** action
   rather than being reported as missing.
3. Port offset: input box pre-filled with the computed suggestion. Validation: integer, `>= 0`,
   multiple of 10.
4. Environment name: input box, default `Local (<domain>)`.

Then one cancellable `withProgress` runs these idempotent steps:

| # | Step | Skipped when |
|---|---|---|
| 1 | `git clone --depth 1 https://github.com/burgan-tech/vnext-runtime.git .vnext-runtime` | directory already exists |
| 2 | append `.vnext-runtime/` to the workspace `.gitignore` | line already present |
| 3 | `make setup` | — (idempotent itself) |
| 4 | `make create-domain DOMAIN=<d> PORT_OFFSET=<n>` | `domains/<d>/.env` exists → parse it and use the **real** ports |
| 5 | `make up-infra` | `vnext-postgres` already running |
| 6 | `make db-create DOMAIN=<d>` | — (Makefile handles "already exists") |
| 7 | `make up-vnext DOMAIN=<d>` | — |
| 8 | poll `http://localhost:<appPort>/health`, 3 s interval, 90 s ceiling | — timeout warns but the flow still counts as success (containers may still be pulling/starting) |
| 9 | persist the environment; make it active if it is the first one | — |
| 10 | `wf domain add …` with discovered values | CLI unavailable → warning + docs link, **non-fatal**. A non-zero exit because the domain is already registered is also non-fatal: the environment stays, and the warning tells the user the domain may already exist in the CLI. |

**Database name is read from disk, not recomputed.** After step 4, parse
`Database=([^;]+)` out of `domains/<d>/appsettings.Development.json`. The runtime repo
applies three different awk normalizations across `create-domain.sh`, `db-create` and
`change-domain`, so trusting the generated file removes an entire class of drift.
`normalizeDbName()` is only the fallback when the file cannot be read.

**Values passed to `wf domain add` in step 10** — all discovered, none asked:
`--API_BASE_URL http://localhost:<appPort>`, `--DB_NAME <discovered>`,
`--DB_HOST localhost`, `--DB_PORT 5432`, `--DB_USER postgres`, `--DB_PASSWORD postgres`,
`--USE_DOCKER true`, `--DOCKER_POSTGRES_CONTAINER vnext-postgres`.

This requires widening `CliService.domainAdd`'s params with optional fields (and the
matching zod `paramsSchema` in the registry). All new fields are optional, so the existing
call site and the existing fixture stay valid and no `MethodHttpSpec` change is needed.

`postgres`/`postgres` are the local development credentials that sit in plain text in the
public runtime repo's compose file. They are still treated as sensitive on the way out:
`process-runner` masks `--DB_PASSWORD <value>` to `--DB_PASSWORD ***` before writing to
the Output channel.

**Cancellation.** The environment is only persisted at step 9, so a cancelled provision
leaves no environment entry — but may leave a clone and a domain config on disk. Because
every step is idempotent, re-running the flow continues from where it stopped. This is
intended behaviour, not a leak.

**Success notification:** *"Local runtime for domain `<d>` is running at http://localhost:<appPort>"*
with actions **Open Quick Run** and **Show Logs**.

### Collision defence (the cost of the in-workspace clone)

The shared infrastructure is not offset-aware, so two clones must not both try to own it:

1. **Offset allocation probes real host ports** — not just `domains/` in the local clone —
   so an offset held by another workspace's clone is seen and skipped.
2. **`up-infra` runs only if `vnext-postgres` is not already running**
   (`docker ps --filter name=vnext-postgres --filter status=running -q` is empty).
3. **`create-network` is already idempotent** in the Makefile (`network inspect || create`).
4. **`domains/<d>/` is never regenerated** when it exists; its `.env` is parsed instead, so
   re-adding the same domain does not shift its ports.

### Lifecycle actions

`contextValue` splits: remote environments keep `environment` (today's menus); managed ones
get `environment-local`. The new items are gated on `viewItem == environment-local` in
`apps/extension/package.json` (`view/item/context`), with matching `commands` entries.

State detection: `docker ps --filter name=vnext-app-<domain> --format {{.Status}}` →
`running | stopped | absent`, cached with a short TTL and refreshed after every action and on
tree refresh. For the active environment this composes with the existing
`EnvironmentHealthMonitor`, so "containers up but `/health` failing" is distinguishable:
the icon reflects container state, the tooltip reflects health.

| Action | Behaviour |
|---|---|
| Start | If `.vnext-runtime` or `domains/<d>` is missing → offer to provision (same orchestration). Otherwise infra check + `make up-vnext`. |
| Stop | `make down-vnext DOMAIN=<d>` |
| Restart | `make restart-vnext DOMAIN=<d>` |
| Show Logs | `ForgeTerminalManager.run('make logs-vnext DOMAIN=<d>', { cwd: runtimePath })` — follow mode; a terminal is the right surface for tailing. |
| Open Runtime Folder | `revealFileInOS` on `runtimePath` |
| Reveal Ports | QuickPick of the five ports; the selected URL is copied to the clipboard. Ports are always in the tooltip too. |
| Update Runtime | `git pull --ff-only` in `runtimePath`. Dirty/diverged → error + "Open Runtime Folder" action. On success: *"Restart the environment to apply changes."* |
| Delete (managed) | Modal confirm spelling out exactly what happens: containers stopped (`down-vnext`), `domains/<d>/` removed, environment entry removed. **The database and the clone are preserved.** |

### Error handling

Every failing step is wrapped in `VnextForgeError`; the existing taxonomy suffices and no new
error code is added:

- missing prerequisite / clone unavailable → `RUNTIME_NOT_AVAILABLE`
- `make` / `docker` / `git` non-zero exit → `RUNTIME_EXECUTION_FAILED`
- health wait exceeded → `RUNTIME_TIMEOUT`

`toLogEntry()` goes to the Output channel, `toUserMessage()` to the notification. Every error
notification carries a **Show Output** action, because the actionable detail (docker's stderr)
lives there.

### Tests

`packages/services-core/test/local-runtime/` (vitest):

- `port-allocator` — fully free, some offsets recorded as used, partially occupied offsets
  (only 4203 taken → that offset is rejected), exhaustion up to `maxOffset`.
- `port-math` — fixed expected table for offsets 0 / 10 / 20; drift from `create-domain.sh`
  breaks the test.
- `domain-env` — parse a realistic template-shaped `.env`; missing and malformed lines.
- `db-name` — `core → vNext_Core`, `my-domain → vNext_My_domain`, empty/invalid input;
  `extractDbNameFromAppSettings` hit and miss.
- `preflight` — combinations of missing tools; installed-but-daemon-down produces the
  "not running" state, not the "not found" state.
- `container-runtime` — table test over every combination with a fake `ToolLookup`:
  `orb`+`docker` → docker/orbstack; `docker` only → docker/docker; `orb` without `docker` →
  falls through (the deliberate divergence from the Makefile); `podman` + `podman-compose`;
  `podman` + `podman compose`; `docker` + `docker-compose` but no `docker compose`;
  nothing installed → missing-runtime result. Also: a binary absent from `PATH` but present in
  a well-known location resolves to its absolute path.
- `commands` — argv shape for each command; regression lock that nothing builds a shell string.

`packages/designer-ui` (vitest): the Part 1 tests listed above.

**Explicit gap:** the `apps/extension` orchestration has **no unit tests** — that workspace has
no test runner and adding one is separate work. Assurance there is `tsc` + the esbuild host
build + manual verification: in a real workspace, add a local environment and walk
start → stop → restart → logs → reveal ports → update → delete.

### Deferred

- `db-reset` action (destructive).
- Separate infrastructure management UI (`up-infra` / `down-infra` as their own node).
- Pinning the clone to a release tag.
- A vitest setup for `apps/extension`.
