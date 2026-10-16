---
name: forge-e2e
description: Verify a vnext-forge change end to end against a locally built vNext runtime — runtime baseline with vnext-example integration suites, the rule-mirror guard, and browser-driven checks of the Forge web shell (schema editor, designer, QuickRun, Monitor, Function Run). Use after runtime-alignment work or any feature that talks to the runtime; triggers "e2e", "uçtan uca test", "runtime'a karşı test et", "forge'u ayağa kaldır", "doğrula".
---

# Forge E2E

The contract is [docs/testing/e2e.md](../../../docs/testing/e2e.md) — read it before step 1. Runtime
side follows the vnext repo's `runtime-integration-test` skill; this skill adds the Forge half.

## Decide first

Apply the table in contract §1. Pure UI/refactor/docs → unit tests are enough; say so and stop.

## Procedure

1. **Unit gate.** `tsc -b` + `vitest run` in every touched workspace; fix reds before infrastructure.
2. **Runtime.** In `../vnext`: `etc/docker/run-docker.sh status`, check who owns :4201 (`lsof` → `ps`);
   stop stale hosts from other checkouts; `./run-docker.sh up core`. Note the runtime commit and
   `/health` version (contract §3.1 — version gates may hide features on an unbumped master).
3. **Baseline.** In `../vnext-example`, run the suites that cover the feature (`TEST-SCENARIOS.md`
   index). All green before touching Forge; a red is runtime/environment (contract §3.2).
4. **Workspace copy + link.** Copy vnext-example to the scratchpad, pin `schemaVersion`, back up and
   repoint `~/vnext-projects/<domain>.link.json` (contract §3.3).
5. **Forge up.** `preview_start` server + web; fallback: background `pnpm --filter … dev` jobs; open
   `http://localhost:3000` in the browser pane.
6. **Guard.** `E2E_EXAMPLE_ROOT=<copy> pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/e2e`
   — non-zero counts, no findings.
7. **UI checks.** Walk contract §4.4 (and the rows for the feature you changed) with the techniques in
   §4.2. Check what the runtime stored, not only what the UI shows (hash files, read `functions/data`).
8. **Missing scenario?** Add it to vnext-example in a separate worktree/branch with the
   `runtime-integration-test` rules (README + `TEST-SCENARIOS.md` rows, same commit), run it, copy the
   components into the workspace copy, then test the UI on it.
9. **Fix → re-run.** A Forge finding gets a fix with a unit test, then the failed check again.
10. **Clean up and report** (contract §5–§6). Update contract §7 *Last run* and §4.4 when the feature
    added rows.

## Red flags

| Thought | Reality |
|---|---|
| "The runtime is already running on :4201" | Check which checkout it is; stale hosts answered with 0.0.98 on 2026-10-16 |
| "Point Forge at the real vnext-example" | Forge writes files; use the copy |
| "Unit tests cover it" | They did not catch sample data filling file fields — the UI run did |
| "The widget looks right" | Hash the stored bytes; compare with the handle `eTag` |
| "Commit the new scenario on the current branch" | Separate worktree + branch in vnext-example, not pushed |
