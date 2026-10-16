---
name: forge-e2e
description: Scope is repo-wide. End-to-end verification of vnext-forge changes against a locally built vNext runtime (runtime baseline with vnext-example integration suites, rule-mirror guard, browser checks of the web shell). Trigger after runtime-alignment work or any change to QuickRun, Instance Monitor, Function Run, runtime proxy, schema validation, Monaco schemas or runtime rule mirrors.
---

# Forge E2E

Follow the procedure in [`.claude/skills/forge-e2e/SKILL.md`](../../../../.claude/skills/forge-e2e/SKILL.md);
the contract (environment, techniques, scenario checklist, report) is
[`docs/testing/e2e.md`](../../../../docs/testing/e2e.md). Keep both in sync when the method changes.
