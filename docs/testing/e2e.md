# End-to-end verification against a live vNext runtime

How to prove a Forge change works against a **locally built** vNext runtime, not just in unit tests.
The procedure for agents is the `forge-e2e` skill (`.claude/skills/forge-e2e/SKILL.md`); this file is
the contract it follows. Sibling repos are referred to as `../<repo>` from the vnext-forge checkout
(`burgan-tech/vnext`, `burgan-tech/vnext-example`); never commit an absolute path.

## 1. When it is required

| Change | E2E |
|---|---|
| Alignment with a new runtime / vnext-schema release (new annotations, workflow attributes, runtime functions, error codes) | **Required** |
| A feature that talks to the runtime (QuickRun, Instance Monitor, Function Run, runtime proxy, schema validation, Monaco schemas) | **Required** |
| Designer-only behaviour derived from runtime rules (rule mirrors, role gating, lint) | Required: run the rule-mirror guard (§4.3) at least |
| Pure UI tweak, refactor, docs | Unit tests are enough — say so in the report |

## 2. The layers

1. **Unit tests** — `vitest` in every touched workspace, `tsc -b`, lint on touched files.
2. **Runtime baseline** — the vnext-example integration suites for the feature, on the runtime built
   from the `vnext` checkout under test. A red here is a runtime/environment problem, not a Forge one;
   settle it before testing Forge.
3. **Rule-mirror guard** — Forge's design-time copies of the runtime's publish rules must raise nothing
   on components the runtime accepted (`packages/designer-ui/src/e2e/`, opt-in, §4.3).
4. **UI e2e** — drive the Forge web shell in the browser pane against the same runtime: open real
   components, edit, save, run QuickRun / Monitor / Function Run, and check what the runtime stored.
5. **Extension-only checks** — what the browser cannot reach (VS Code Problems / quick fixes, host
   save/open frames, webview CSP). List them in the report as *not covered* unless run by hand.

## 3. Environment

### 3.1 Runtime (repo `vnext`)

Follow the vnext `runtime-integration-test` skill and its contract (`docs/testing/integration-testing.md`).
In short:

```bash
cd ../vnext/etc/docker
./run-docker.sh status                       # what is registered / running
lsof -iTCP:4201 -sTCP:LISTEN                 # then: ps -o command -p <pid>
```

- **Stale hosts:** if :4201/:4202/:4401/:4501 are served by binaries from another checkout or an old
  run (e.g. `Unhealthy`, database down, older `version` in `/health`), stop those processes before
  `up` — they answer instead of the build under test.
- `./run-docker.sh up core` builds this checkout and starts infra + sidecars + DbMigrator + the four
  hosts; the record lands in `ai-docs/local-environments/core.md`. The orchestration sidecar gets the
  `vnext-blob-local` binding (needed by `x-storage`).
- System flows: on a fresh database load `@burgan-tech/vnext-core-runtime` once through the init
  container (see the vnext runbook). An existing database already has `sys_*` schemas.
- `/health` may report the previous assembly version on `master` before the release bump (2026-10-16:
  the 0.0.100 code reported `0.0.99.0`). Forge's runtime version gates (`useRuntimeSupports`) then hide
  features — open those screens by route instead and note it.

### 3.2 Runtime baseline (repo `vnext-example`)

```bash
cd ../vnext-example
dotnet test tests/Core.IntegrationTests --settings tests/Core.IntegrationTests/test.runsettings \
  --filter "FullyQualifiedName~<Suite>|FullyQualifiedName~<Suite2>" -v minimal
```

Read `TEST-SCENARIOS.md` § *Koşum Öncesi Kontrol* first. The SDK publishes the domain's `core/**`
components itself, so after a green run the lab workflows exist on the runtime for QuickRun.

**Missing scenario** (the existing flows cannot exercise the Forge feature): add one with the vnext
`runtime-integration-test` skill rules — flow + test class + scenario README + `TEST-SCENARIOS.md` rows,
one commit — in a **separate worktree and branch** of vnext-example (do not commit on the user's
checkout), upstream unset, not pushed. Example: `forge-file-form-lab` (2026-10-16).

### 3.3 Forge

- **Workspace copy.** Forge saves files. Point it at a copy of vnext-example in the scratchpad
  (`rsync` without `node_modules`, `bin`, `obj`, `.git`, `dist`), never at the user's checkout. Set the
  copy's `vnext.config.json#schemaVersion` to the schema release under test.
- **Project link.** The web shell resolves the project by `~/vnext-projects/<domain>.link.json`
  (`{"sourcePath", "domain"}`). Back the existing file up, point `sourcePath` at the copy, and **restore
  it at the end**. `projects/remove` on a linked project only deletes the link file, but don't rely on it.
- **Servers.** `preview_start` with `server` (:3001) and `web` (:3000) from `.claude/launch.json`. If the
  launcher cannot read the checkout (`getcwd: Operation not permitted`), run
  `pnpm --filter @vnext-forge-studio/server dev` and `pnpm --filter @vnext-forge-studio/web dev` as
  background shell jobs and open `http://localhost:3000` in the browser pane. The server's default
  runtime URL is `http://localhost:4201`.
- **Port clash:** MockLab also wants :3001. When a suite needs MockLab, move Forge's server
  (`PORT=` in `apps/server/.env`) and point the web shell at it (`VITE_API_BASE_URL=` in `apps/web/.env`;
  add the web origin to `CORS_ALLOWED_ORIGINS` if it changes).

## 4. Running the checks

### 4.1 Routes (web shell)

`/project/<id>/` + `schema/<group>/<name>`, `flow/<group>/<name>`, `quickrun/<group>/<name>`,
`monitor/<group>/<name>/<instanceId>`, `function-run-instance/<domain>/<fn>?scope=I&workflowKey=&instanceId=`,
`code/<encodeURIComponent(absolute path)>`.

### 4.2 Browser-pane techniques

- Prefer `find` / `get_page_text` / `javascript_tool` over screenshots to read state.
- **Native `<select>`:** `form_input` may not reach React; set the value with the prototype setter and
  dispatch `change` (`Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set`).
- **File inputs:** build a `File` from random bytes, put it on the input with `DataTransfer`, dispatch
  `change`; compute its SHA-256 in the page (`crypto.subtle.digest`) and compare with the handle's
  `eTag` after the run.
- **Downloads:** stub `HTMLAnchorElement.prototype.click` to capture `download` / `href`, or call the
  RPC (`POST :3001/api/v1/quickrun/downloadFile`) and hash the base64 body.
- **Monaco:** markers refresh after an edit, sometimes only after a second one; read
  `.squiggly-error` with the line under it. Discard edits (navigate away, `force: true`).
- HTTP probes from the shell may be blocked by a hook; use the sandboxed executor or `fetch` in the page.

### 4.3 Rule-mirror guard

```bash
E2E_EXAMPLE_ROOT=<path to the vnext-example copy> \
  pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/e2e
```

Walks every schema and workflow under `core/` and runs the role, `x-computed`, `x-storage`,
field-protection and `history: none` mirrors. Expect `[e2e] checked {…}` with non-zero counts and no
findings. A finding on a runtime-accepted component is a Forge false positive — fix the mirror.
Deliberately invalid fixtures are listed in `DELIBERATELY_INVALID`.

### 4.4 Scenario checklist (runtime 0.0.100 / vnext-schema 0.0.56)

| Area | Steps | Expected |
|---|---|---|
| Schema roles | Open a schema with a legacy type that a workflow references as master (`file-offload-lab/fo-master`) | Role picker, legacy warning, **Use master** (from `vnext/schemas/inferRole`); save passes 0.0.56 validation |
| Role-gated cards | vNext tab on a master property | Refused cards listed under *Not available on a master schema*; `x-storage` card without errors on a valid file field |
| Monaco | `code/` route on a role-typed schema | `validate/getVocabularies?schemaVersion=…` 200, no squiggles; a legacy `attributes.type` is squiggled |
| history: none | `flow/history-none-lab/hn-oneshot` → settings | History = None; cancel/exit/timeout/update-data/shared create buttons disabled with the reason |
| history: none rules | Switch a flow with manual / Human / long-poll states to None (unsaved) | Problems gains `history.*` issues and server validation errors |
| QuickRun files | `quickrun/forge-file-form-lab/ffl-flow` → New Run, upload through the widget, Start; then `replace` | Generated sample data leaves file fields empty; Data tab lists the file; handle `eTag` = page-side SHA-256 |
| Downloads | Save as on a stored file; `downloadFile` RPC | Bytes' SHA-256 = `eTag`; content type and name from the handle |
| Monitor | `monitor/.../<history-none instance>` and a file instance | One-shot notice + path-rail text, no error banner; Data tab file list |
| Function Run | `function-run-instance/core/file?…` with a stored file id | Name, size, type, ETag, Open / Save as |

Extend the table when a feature is added.

## 5. Cleanup

Restore `~/vnext-projects/<domain>.link.json` from the backup, stop the Forge dev servers, leave the
runtime running (say so) unless you started it only for this run and the user asked to stop it
(`./run-docker.sh down core`). Delete nothing in the user's checkouts.

## 6. Report

Runtime commit and base URL, suites and counts, guard counts, each UI check with its result, every
finding (fixed or not) with its cause, what was not covered (§2.5), and the branches/commits created in
sibling repos. Put the same in the PR body under `## E2E evidence`.

## 7. Last run

2026-10-16 — vnext `master` @ `f06961ec` (v0.0.100, `/health` 0.0.99.0), vnext-schema 0.0.56:
baseline FileOffloadLab + HistoryNoneLab + HistoryNoneSubflowLab + SchemaRolesLab 59/59,
ForgeFileFormLab 4/4 (new, vnext-example `feature/forge-file-form-lab`); guard 0 findings over 91
workflows and ~400 annotations; all §4.4 rows passed after two fixes (sample data filled file fields;
legacy-type hint wording). Not covered: VS Code Problems / quick fix / Fix Legacy Schema Types, host
save/open frames. Open finding: the web server strips error `details`, so runtime codes and hints
(e.g. `Instance:100049`) reach the banner in VS Code but not in the web shell.
