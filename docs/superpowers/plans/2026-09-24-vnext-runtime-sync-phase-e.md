# vNext Runtime Sync — Phase E (Forge Tools) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Forge Tools generate offline attribute-index SQL through `wf indexes generate` (Workflow CLI ≥ 1.1.0), gate it on the probed CLI version, and warn in Package Deploy when the CLI is too old to send the publish-completed signal.

**Architecture:** Every decision lives in a small, pure, unit-tested module. services-core gets the version gates, the argv builder and the stdout parser, next to the existing `wf` helpers. The extension gets vscode-free modules for probe facts, upgrade copy, tree-node selection, the captured child-process run, solution checks and the local flow list. The VS Code glue (`DatabaseProvider`, the Package Deploy tweak, `extension.ts`, `package.json`) only wires those modules to tree items, quick picks and notifications. `indexes generate` runs captured with `execFile` (no terminal, no prompts) so Forge can parse its result line and reveal the batch folder.

**Tech Stack:** TypeScript 5.7, VS Code extension API (`TreeDataProvider`, `showQuickPick`, `withProgress`), Node `child_process.execFile`, vitest 3, pnpm + Turborepo, esbuild (extension host).

**Spec:** `docs/superpowers/specs/2026-09-24-vnext-runtime-sync-design.md` (Phase E items 1–5; Decision D8: web/server `cli/execute` support for `indexes generate` is out of scope)

## Global Constraints

- All development happens in vnext-forge only. `vnext-workflow-cli` (`/Users/U0B006/Documents/repos/burgan-tech/vnext-workflow-cli`, `origin/master`) is a read-only reference.
- CLI contract (from `origin/master`, `bin/workflow.js` + `src/commands/indexes.js` + `src/lib/indexes/definitions.js`): `wf indexes generate [--flow <key>] [-o|--output <dir>] [--retire-obsolete]`; success prints `  ✓ Generated <N> SQL file(s): <absolute batch folder>`; errors print `  ✗ <message>` and set exit code 1. The batch folder holds `<schema>.sql` files, `manifest.json` and `README.txt`. Flow key rule: `/^[a-zA-Z_][a-zA-Z0-9_-]*$/`, at most 63 characters. The command reads only `vnext.config.json` in cwd and ignores `--domain`.
- `WF_INDEXES_MIN_VERSION = '1.1.0'` is the only version literal for Phase E. publish-completed (CLI `524495f`) ships in the same release, so `WF_PUBLISH_COMPLETED_MIN_VERSION` is an alias of it, not a second literal.
- `indexes generate` **never** gets `--domain` and **never** gets the legacy `wf domain use <d> &&` prefix.
- D8: do not touch `CLI_ALLOWED_COMMANDS`, `cli/execute`, `apps/server` or `apps/web`.
- All user-visible strings are English (repo rule in `CLAUDE.md`). Notifications keep the existing `vnext-forge-studio: ` prefix used by Forge Tools providers.
- Command ids follow the existing Forge Tools convention in `apps/extension/package.json`: `vnextForge.tools.<camelCase>`, `"category": "Forge"`, a `$(codicon)` icon when shown in a view. Tree-only commands are hidden from the palette with `"when": "false"`.
- Extension modules that hold logic must not import `vscode` (the extension vitest config cannot resolve it — see `apps/extension/vitest.config.ts`). Tests are `src/**/*.vitest.test.ts`.
- Spawning goes through `buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST)` from services-core.
- Branch: `f/vnext-runtime-sync`. Commit only at the Commit steps. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Test commands: `pnpm --filter @vnext-forge-studio/services-core exec vitest run <path relative to packages/services-core>` and `pnpm --filter vnext-forge-studio exec vitest run <path relative to apps/extension>`. Type checks: `pnpm --filter @vnext-forge-studio/services-core build` (`tsc -b`) and `pnpm --filter vnext-forge-studio exec tsc --noEmit -p tsconfig.json` (the extension build is esbuild and does not type-check; this command is clean at the Phase E start commit). The extension imports services-core from source (`main: ./src/index.ts`), so no services-core build is needed before extension tests.
- Lint: per-package `eslint .` is already red. No touched file may gain ESLint errors compared with the Phase E start commit (checked in Task 9).

## File Map

| File | Responsibility |
|---|---|
| `packages/services-core/src/services/cli/wf-argv.ts` | + `WF_INDEXES_MIN_VERSION`, `WF_PUBLISH_COMPLETED_MIN_VERSION`, `wfSupportsIndexes`, `wfSupportsPublishCompleted`, flow-key rule, `buildWfIndexesGenerateArgv` |
| `packages/services-core/src/services/cli/wf-indexes-output.ts` (new) | parse `wf indexes generate` stdout/stderr into generated / failed |
| `packages/services-core/src/services/cli/index.ts` | re-exports |
| `packages/services-core/test/cli/wf-argv.test.ts`, `test/cli/wf-indexes-output.test.ts` (new) | unit tests |
| `apps/extension/src/tools/wf-cli-probe.ts` | + `supportsIndexes`, `supportsPublishCompleted`, `WF_CLI_NOT_INSTALLED`, `onDidInvalidate` |
| `apps/extension/src/tools/wf-cli-features.ts` (new) | `WfCliFeature`, `WF_CLI_FEATURES`, `wfCliUpgradeMessage` (pure copy) |
| `apps/extension/src/tools/wf-cli-upgrade-notice.ts` | generalized `maybeShow(info, feature)` / `show(info, feature)` |
| `apps/extension/src/tools/providers/package-deploy-nodes.ts` (new) | pure node selection for Package Deploy (+ publish-completed info node) |
| `apps/extension/src/tools/providers/package-deploy-provider.ts` | renders the info node |
| `apps/extension/src/tools/wf-captured-run.ts` (new) | `execFile('wf', argv)` with captured output, never rejects |
| `apps/extension/src/tools/index-sql/index-sql-plan.ts` (new) | Database node selection, solution check, local flow list, batch paths, copy |
| `apps/extension/src/tools/providers/database-provider.ts` (new) | Database tree + Generate Index SQL flow (VS Code glue) |
| `apps/extension/src/tools/index-sql/database-contributes.vitest.test.ts` (new) | `package.json` / `extension.ts` wiring guard |
| `apps/extension/src/extension.ts`, `apps/extension/package.json` | construction, tree view, commands, contributes |

---

### Task 1: services-core — indexes version gate and argv builder

**Files:**
- Modify: `packages/services-core/src/services/cli/wf-argv.ts` (constants after `WF_DOMAIN_NAME_PATTERN`; replace the body of `wfSupportsDomainFlag`; new builder after `buildWfArgv`)
- Modify: `packages/services-core/src/services/cli/index.ts` (the `./wf-argv.js` export block)
- Test: `packages/services-core/test/cli/wf-argv.test.ts`

**Interfaces:**
- Produces: `WF_INDEXES_MIN_VERSION: '1.1.0'`, `WF_PUBLISH_COMPLETED_MIN_VERSION` (same value), `WF_FLOW_KEY_PATTERN: RegExp`, `WF_FLOW_KEY_MAX_LENGTH = 63`, `wfSupportsIndexes(version: string | null | undefined): boolean`, `wfSupportsPublishCompleted(version: string | null | undefined): boolean`, `isValidWfFlowKey(key: string): boolean`, `interface WfIndexesGenerateSpec { base: 'indexes generate'; flow?: string; output?: string; retireObsolete?: boolean }`, `buildWfIndexesGenerateArgv(spec: WfIndexesGenerateSpec): string[]` — all exported from `@vnext-forge-studio/services-core`.

- [ ] **Step 1: Record the Phase E start commit (used by the Task 9 lint gate)**

Run: `git rev-parse HEAD > "$(git rev-parse --git-dir)/phase-e-base" && cat "$(git rev-parse --git-dir)/phase-e-base"`
Expected: one commit hash. The file lives inside `.git/`, so it is never committed.

- [ ] **Step 2: Write the failing tests**

In `packages/services-core/test/cli/wf-argv.test.ts`, replace the import block with:

```ts
import { describe, expect, it } from 'vitest'

import {
  buildWfArgv,
  buildWfIndexesGenerateArgv,
  buildWfShellCommand,
  isValidWfDomainName,
  isValidWfFlowKey,
  quoteShellArg,
  WF_INDEXES_MIN_VERSION,
  WF_PUBLISH_COMPLETED_MIN_VERSION,
  wfSupportsDomainFlag,
  wfSupportsIndexes,
  wfSupportsPublishCompleted,
  type WfIndexesGenerateSpec,
} from '../../src/services/cli/wf-argv.js'
```

Append at the end of the file:

```ts
describe('wfSupportsIndexes / wfSupportsPublishCompleted', () => {
  it('uses one 1.1.0 floor for both features', () => {
    expect(WF_INDEXES_MIN_VERSION).toBe('1.1.0')
    expect(WF_PUBLISH_COMPLETED_MIN_VERSION).toBe(WF_INDEXES_MIN_VERSION)
  })

  it('accepts 1.1.0 and newer, rejects older and unknown', () => {
    for (const gate of [wfSupportsIndexes, wfSupportsPublishCompleted]) {
      expect(gate('1.1.0')).toBe(true)
      expect(gate('v1.1.0')).toBe(true)
      expect(gate('wf 1.2.3\n')).toBe(true)
      expect(gate('2.0.0-beta.1')).toBe(true)
      expect(gate('1.0.14')).toBe(false)
      expect(gate('1.0.13')).toBe(false)
      expect(gate(undefined)).toBe(false)
      expect(gate(null)).toBe(false)
      expect(gate('')).toBe(false)
      expect(gate('dev-build')).toBe(false)
    }
  })

  it('leaves the --domain gate at 1.0.13', () => {
    expect(wfSupportsDomainFlag('1.0.13')).toBe(true)
    expect(wfSupportsDomainFlag('1.0.12')).toBe(false)
  })
})

describe('isValidWfFlowKey', () => {
  it('follows the CLI physical-schema rule', () => {
    expect(isValidWfFlowKey('money-transfer')).toBe(true)
    expect(isValidWfFlowKey('_internal_flow')).toBe(true)
    expect(isValidWfFlowKey('A1')).toBe(true)
    expect(isValidWfFlowKey('a'.repeat(63))).toBe(true)
    expect(isValidWfFlowKey('a'.repeat(64))).toBe(false)
    expect(isValidWfFlowKey('1-starts-with-digit')).toBe(false)
    expect(isValidWfFlowKey('-starts-with-dash')).toBe(false)
    expect(isValidWfFlowKey('has space')).toBe(false)
    expect(isValidWfFlowKey('has.dot')).toBe(false)
    expect(isValidWfFlowKey('')).toBe(false)
  })
})

describe('buildWfIndexesGenerateArgv', () => {
  it('builds the all-flows form', () => {
    expect(buildWfIndexesGenerateArgv({ base: 'indexes generate' })).toEqual(['indexes', 'generate'])
  })

  it('adds --flow, -o and --retire-obsolete in CLI order', () => {
    expect(
      buildWfIndexesGenerateArgv({
        base: 'indexes generate',
        flow: '  money-transfer ',
        output: './index-sql',
        retireObsolete: true,
      }),
    ).toEqual(['indexes', 'generate', '--flow', 'money-transfer', '-o', './index-sql', '--retire-obsolete'])
    expect(buildWfIndexesGenerateArgv({ base: 'indexes generate', retireObsolete: false })).toEqual([
      'indexes',
      'generate',
    ])
  })

  it('rejects an invalid flow key or output folder', () => {
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', flow: '' })).toThrow(/not a valid flow key/)
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', flow: 'x;rm' })).toThrow(
      /not a valid flow key/,
    )
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', flow: 'a'.repeat(64) })).toThrow(
      /not a valid flow key/,
    )
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', output: '  ' })).toThrow(
      /output folder must not be empty/,
    )
    expect(() => buildWfIndexesGenerateArgv({ base: 'indexes generate', output: '--retire-obsolete' })).toThrow(
      /must not start with "-"/,
    )
  })

  it('never emits --domain, even when a caller smuggles one in', () => {
    const spec = { base: 'indexes generate', flow: 'loan', domain: 'core' } as WfIndexesGenerateSpec & {
      domain: string
    }
    const argv = buildWfIndexesGenerateArgv(spec)
    expect(argv).toEqual(['indexes', 'generate', '--flow', 'loan'])
    expect(argv).not.toContain('--domain')
    expect(argv).not.toContain('core')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/cli/wf-argv.test.ts`
Expected: FAIL — `buildWfIndexesGenerateArgv` / `wfSupportsIndexes` are not exported (`is not a function`).

- [ ] **Step 4: Implement**

In `packages/services-core/src/services/cli/wf-argv.ts`, insert after `export const WF_DOMAIN_NAME_PATTERN = /^[A-Za-z0-9._-]+$/`:

```ts
/**
 * First CLI release with `wf indexes generate` (offline attribute-index SQL).
 * The CLI release branch is not decided yet — if the command ships as 1.0.14,
 * this is the one literal to change.
 */
export const WF_INDEXES_MIN_VERSION = '1.1.0'

/**
 * First CLI release that signals publish-completed after publishing (CLI
 * `524495f`, replacing the removed re-initialize call). It ships in the same
 * release as `wf indexes generate`, so it is deliberately an alias.
 */
export const WF_PUBLISH_COMPLETED_MIN_VERSION = WF_INDEXES_MIN_VERSION

/**
 * The CLI turns a flow key into a PostgreSQL schema name
 * (`src/lib/indexes/definitions.js`, `physicalSchema`) and rejects anything else.
 */
export const WF_FLOW_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/
export const WF_FLOW_KEY_MAX_LENGTH = 63
```

Replace the whole `wfSupportsDomainFlag` function with:

```ts
function versionAtLeast(version: string | null | undefined, minVersion: string): boolean {
  if (!version) return false
  const core = extractCoreSemver(version)
  if (!core) return false
  return compareCoreSemver(core, minVersion) >= 0
}

/** `true` when the version string carries a core semver ≥ 1.0.13; unknown → `false`. */
export function wfSupportsDomainFlag(version: string | null | undefined): boolean {
  return versionAtLeast(version, WF_DOMAIN_FLAG_MIN_VERSION)
}

/** `true` when `wf indexes generate` exists (≥ `WF_INDEXES_MIN_VERSION`); unknown → `false`. */
export function wfSupportsIndexes(version: string | null | undefined): boolean {
  return versionAtLeast(version, WF_INDEXES_MIN_VERSION)
}

/** `true` when the CLI signals publish-completed (≥ `WF_PUBLISH_COMPLETED_MIN_VERSION`); unknown → `false`. */
export function wfSupportsPublishCompleted(version: string | null | undefined): boolean {
  return versionAtLeast(version, WF_PUBLISH_COMPLETED_MIN_VERSION)
}

export function isValidWfFlowKey(key: string): boolean {
  return key.length <= WF_FLOW_KEY_MAX_LENGTH && WF_FLOW_KEY_PATTERN.test(key)
}
```

Insert after the `buildWfArgv` function:

```ts
export interface WfIndexesGenerateSpec {
  base: 'indexes generate'
  /** One workflow key (all of its local versions); omit for every flow. */
  flow?: string
  /** Parent folder for the new batch; the CLI default is `index-sql` in cwd. */
  output?: string
  retireObsolete?: boolean
}

/**
 * argv for `execFile('wf', argv)` running `wf indexes generate`.
 *
 * Deliberately separate from `WfCommandSpec` / `buildWfArgv` /
 * `buildWfShellCommand`: the command is offline and reads only
 * `vnext.config.json` in cwd, so it never takes `--domain`, and the legacy
 * `wf domain use <d> &&` prefix would only rewrite the CLI's active profile
 * for nothing.
 */
export function buildWfIndexesGenerateArgv(spec: WfIndexesGenerateSpec): string[] {
  const argv = ['indexes', 'generate']
  if (spec.flow !== undefined) {
    const flow = spec.flow.trim()
    if (!isValidWfFlowKey(flow)) {
      throw new Error(`"${spec.flow}" is not a valid flow key for index generation.`)
    }
    argv.push('--flow', flow)
  }
  if (spec.output !== undefined) {
    const output = spec.output.trim()
    if (!output) throw new Error('The output folder must not be empty.')
    if (output.startsWith('-')) throw new Error('The output folder must not start with "-".')
    argv.push('-o', output)
  }
  if (spec.retireObsolete) argv.push('--retire-obsolete')
  return argv
}
```

In `packages/services-core/src/services/cli/index.ts`, replace the `./wf-argv.js` export block with:

```ts
export {
  buildWfArgv,
  buildWfIndexesGenerateArgv,
  buildWfShellCommand,
  isValidWfDomainName,
  isValidWfFlowKey,
  quoteShellArg,
  WF_DOMAIN_FLAG_MIN_VERSION,
  WF_DOMAIN_NAME_PATTERN,
  WF_FLOW_KEY_MAX_LENGTH,
  WF_FLOW_KEY_PATTERN,
  WF_INDEXES_MIN_VERSION,
  WF_PUBLISH_COMPLETED_MIN_VERSION,
  wfSupportsDomainFlag,
  wfSupportsIndexes,
  wfSupportsPublishCompleted,
  type WfCommandSpec,
  type WfIndexesGenerateSpec,
  type WfShellCommandOptions,
  type WfWorkspaceCommand,
} from './wf-argv.js'
```

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/cli/wf-argv.test.ts && pnpm --filter @vnext-forge-studio/services-core build`
Expected: PASS (all old and new `wf-argv` tests), `tsc -b` exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/services-core/src/services/cli/wf-argv.ts packages/services-core/src/services/cli/index.ts packages/services-core/test/cli/wf-argv.test.ts
git commit -m "$(cat <<'EOF'
feat(services-core): wf indexes generate argv and 1.1.0 version gate

WF_INDEXES_MIN_VERSION is the single literal; publish-completed aliases it.
The indexes argv never carries --domain or the legacy domain-use prefix.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: services-core — `wf indexes generate` output parser

**Files:**
- Create: `packages/services-core/src/services/cli/wf-indexes-output.ts`
- Modify: `packages/services-core/src/services/cli/index.ts` (append an export)
- Test: `packages/services-core/test/cli/wf-indexes-output.test.ts`

**Interfaces:**
- Consumes: `stripAnsi(text: string): string` from `packages/services-core/src/lib/ansi.ts` (already used by `wf-domain-list.ts`).
- Produces: `type WfIndexesGenerateOutcome = { kind: 'generated'; count: number; batchPath: string } | { kind: 'failed'; message: string }`, `parseWfIndexesGenerateOutput(stdout: string, stderr?: string): WfIndexesGenerateOutcome` — exported from `@vnext-forge-studio/services-core`.

- [ ] **Step 1: Write the failing tests**

Create `packages/services-core/test/cli/wf-indexes-output.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { parseWfIndexesGenerateOutput } from '../../src/services/cli/wf-indexes-output.js'

// Shapes follow vnext-workflow-cli origin/master src/commands/indexes.js:
// LOG.success(`Generated ${count} SQL file(s): ${batch}`) → "  ✓ …" (chalk green),
// LOG.info(...) → "  ○ …" (chalk dim), LOG.error(message) → "  ✗ …" (chalk red).

describe('parseWfIndexesGenerateOutput', () => {
  it('reads the count and the batch folder from the success line', () => {
    const stdout =
      '  ✓ Generated 2 SQL file(s): /ws/index-sql/2026-09-24T10-00-00-000Z-Ab12Cd\n' +
      '  ○ No API or database connection was made. Give this batch to your DBA for review and execution.\n'
    expect(parseWfIndexesGenerateOutput(stdout)).toEqual({
      kind: 'generated',
      count: 2,
      batchPath: '/ws/index-sql/2026-09-24T10-00-00-000Z-Ab12Cd',
    })
  })

  it('ignores ANSI colours and keeps Windows paths with spaces intact', () => {
    const stdout =
      '\u001b[32m  ✓ Generated 1 SQL file(s): C:\\Work Space\\index-sql\\2026-09-24T10-00-00-000Z-x\u001b[39m\r\n' +
      '\u001b[2m  ○ No API or database connection was made.\u001b[22m\r\n'
    expect(parseWfIndexesGenerateOutput(stdout)).toEqual({
      kind: 'generated',
      count: 1,
      batchPath: 'C:\\Work Space\\index-sql\\2026-09-24T10-00-00-000Z-x',
    })
  })

  it('returns the CLI error line on failure', () => {
    const stdout =
      '\u001b[31m  ✗ No workflows referencing attributes.type: master schemas found; no SQL files generated.\u001b[39m\n'
    expect(parseWfIndexesGenerateOutput(stdout)).toEqual({
      kind: 'failed',
      message: 'No workflows referencing attributes.type: master schemas found; no SQL files generated.',
    })
  })

  it('prefers an Error: line from a crash over the trailing Node banner', () => {
    const stderr =
      '/usr/lib/node_modules/@burgan-tech/vnext-workflow-cli/src/lib/indexes/sql.js:10\n' +
      'TypeError: Cannot read properties of undefined (reading \'map\')\n' +
      '    at generateSql (sql.js:10:5)\n\nNode.js v20.11.0\n'
    expect(parseWfIndexesGenerateOutput('', stderr)).toEqual({
      kind: 'failed',
      message: "TypeError: Cannot read properties of undefined (reading 'map')",
    })
  })

  it('falls back to the last line, then to a fixed message', () => {
    expect(parseWfIndexesGenerateOutput('something unexpected\n\n')).toEqual({
      kind: 'failed',
      message: 'something unexpected',
    })
    expect(parseWfIndexesGenerateOutput('', '')).toEqual({
      kind: 'failed',
      message: 'The Workflow CLI printed no result.',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/cli/wf-indexes-output.test.ts`
Expected: FAIL — `Failed to load url ../../src/services/cli/wf-indexes-output.js`.

- [ ] **Step 3: Implement**

Create `packages/services-core/src/services/cli/wf-indexes-output.ts`:

```ts
import { stripAnsi } from '../../lib/ansi.js'

/**
 * Parser for the output of `wf indexes generate` (vnext-workflow-cli ≥ 1.1.0,
 * `src/commands/indexes.js`). The CLI prints through chalk:
 *   success → `  ✓ Generated <N> SQL file(s): <absolute batch folder>`
 *   failure → `  ✗ <message>` and exit code 1
 * Colours are normally off when stdout is not a TTY; they are stripped anyway.
 */
export type WfIndexesGenerateOutcome =
  | { kind: 'generated'; count: number; batchPath: string }
  | { kind: 'failed'; message: string }

const GENERATED_LINE = /Generated (\d+) SQL file\(s\): (.+)$/
const CLI_ERROR_LINE = /^✗\s+(.+)$/
const CRASH_ERROR_LINE = /^[A-Za-z]*Error: .+$/
const NO_RESULT_MESSAGE = 'The Workflow CLI printed no result.'

export function parseWfIndexesGenerateOutput(stdout: string, stderr = ''): WfIndexesGenerateOutcome {
  const lines = stripAnsi(`${stdout}\n${stderr}`)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  for (const line of lines) {
    const generated = GENERATED_LINE.exec(line)
    if (generated) {
      return {
        kind: 'generated',
        count: Number.parseInt(generated[1] ?? '0', 10),
        batchPath: (generated[2] ?? '').trim(),
      }
    }
  }
  for (const line of lines) {
    const cliError = CLI_ERROR_LINE.exec(line)
    if (cliError) return { kind: 'failed', message: (cliError[1] ?? '').trim() }
  }
  const crash = lines.find((line) => CRASH_ERROR_LINE.test(line))
  if (crash) return { kind: 'failed', message: crash }
  const last = lines.length > 0 ? lines[lines.length - 1] : undefined
  return { kind: 'failed', message: last ?? NO_RESULT_MESSAGE }
}
```

Append to `packages/services-core/src/services/cli/index.ts`:

```ts
export { parseWfIndexesGenerateOutput, type WfIndexesGenerateOutcome } from './wf-indexes-output.js'
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/cli/wf-indexes-output.test.ts && pnpm --filter @vnext-forge-studio/services-core build`
Expected: PASS (5 tests), `tsc -b` exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/cli/wf-indexes-output.ts packages/services-core/src/services/cli/index.ts packages/services-core/test/cli/wf-indexes-output.test.ts
git commit -m "$(cat <<'EOF'
feat(services-core): parse wf indexes generate output

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: extension — probe gains `supportsIndexes` / `supportsPublishCompleted`

**Files:**
- Modify: `apps/extension/src/tools/wf-cli-probe.ts`
- Modify: `apps/extension/src/tools/providers/environments-provider.ts:1269` (fallback literal)
- Test: `apps/extension/src/tools/wf-cli-probe.vitest.test.ts`

**Interfaces:**
- Consumes: `wfSupportsIndexes`, `wfSupportsPublishCompleted` (Task 1).
- Produces: `WfCliInfo` gains required `supportsIndexes: boolean` and `supportsPublishCompleted: boolean`; `WF_CLI_NOT_INSTALLED: WfCliInfo`; `WfCliProbe.onDidInvalidate(listener: () => void): { dispose(): void }` (called on every `invalidate()`; Task 8's `DatabaseProvider` refreshes its tree with it).

- [ ] **Step 1: Write the failing tests**

Replace `apps/extension/src/tools/wf-cli-probe.vitest.test.ts` with:

```ts
import { describe, expect, it, vi } from 'vitest';

import { WF_CLI_NOT_INSTALLED, WfCliProbe, type ExecVersionFn } from './wf-cli-probe.js';

const resolves = (out: string): ExecVersionFn => () => Promise.resolve(out);

describe('WfCliProbe', () => {
  it('parses the version and every capability', async () => {
    expect(await new WfCliProbe(resolves('1.1.0\n')).get()).toEqual({
      installed: true,
      version: '1.1.0',
      supportsDomainFlag: true,
      supportsIndexes: true,
      supportsPublishCompleted: true,
    });
    expect(await new WfCliProbe(resolves('1.0.13')).get()).toEqual({
      installed: true,
      version: '1.0.13',
      supportsDomainFlag: true,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    });
    expect(await new WfCliProbe(resolves('1.0.12')).get()).toEqual({
      installed: true,
      version: '1.0.12',
      supportsDomainFlag: false,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    });
  });

  it('memoizes a successful probe until invalidated', async () => {
    const exec = vi.fn<ExecVersionFn>(resolves('1.0.13'));
    const probe = new WfCliProbe(exec);
    await probe.get();
    await probe.get();
    expect(exec).toHaveBeenCalledTimes(1);
    probe.invalidate();
    await probe.get();
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('reports a missing CLI and re-probes next time', async () => {
    const exec = vi.fn<ExecVersionFn>(() => Promise.reject(new Error('ENOENT')));
    const probe = new WfCliProbe(exec);
    expect(await probe.get()).toEqual(WF_CLI_NOT_INSTALLED);
    expect(WF_CLI_NOT_INSTALLED).toEqual({
      installed: false,
      supportsDomainFlag: false,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    });
    exec.mockImplementationOnce(resolves('1.1.0'));
    expect((await probe.get()).supportsIndexes).toBe(true);
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('keeps an unparsable version string but treats it as legacy', async () => {
    expect(await new WfCliProbe(resolves('dev-build')).get()).toEqual({
      installed: true,
      version: 'dev-build',
      supportsDomainFlag: false,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    });
  });

  it('notifies invalidate listeners until they are disposed', () => {
    const probe = new WfCliProbe(resolves('1.1.0'));
    const listener = vi.fn();
    const subscription = probe.onDidInvalidate(listener);
    probe.invalidate();
    expect(listener).toHaveBeenCalledTimes(1);
    subscription.dispose();
    probe.invalidate();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/wf-cli-probe.vitest.test.ts`
Expected: FAIL — `WF_CLI_NOT_INSTALLED` is undefined and the result objects lack `supportsIndexes`.

- [ ] **Step 3: Implement**

Replace `apps/extension/src/tools/wf-cli-probe.ts` from the first line through the end of the `WfCliInfo` interface with:

```ts
import { execFile } from 'node:child_process';

import {
  extractCoreSemver,
  wfSupportsDomainFlag,
  wfSupportsIndexes,
  wfSupportsPublishCompleted,
} from '@vnext-forge-studio/services-core';

export interface WfCliInfo {
  installed: boolean;
  /** Core semver (`1.0.13`) when the CLI printed one. */
  version?: string;
  /** Installed CLI understands the global `--domain` option (≥ 1.0.13). */
  supportsDomainFlag: boolean;
  /** `wf indexes generate` is available (≥ `WF_INDEXES_MIN_VERSION`). */
  supportsIndexes: boolean;
  /**
   * The CLI signals publish-completed after publishing, so the runtime refreshes
   * its discovery cache (≥ `WF_PUBLISH_COMPLETED_MIN_VERSION`).
   */
  supportsPublishCompleted: boolean;
}

export const WF_CLI_NOT_INSTALLED: WfCliInfo = Object.freeze({
  installed: false,
  supportsDomainFlag: false,
  supportsIndexes: false,
  supportsPublishCompleted: false,
});
```

Replace the whole `WfCliProbe` class with:

```ts
export class WfCliProbe {
  private pending: Promise<WfCliInfo> | undefined;
  private readonly invalidateListeners = new Set<() => void>();

  constructor(private readonly exec: ExecVersionFn = execFileWfVersion) {}

  get(): Promise<WfCliInfo> {
    this.pending ??= this.exec().then(
      (stdout) => {
        const trimmed = stdout.trim();
        const version = extractCoreSemver(trimmed) ?? (trimmed.length > 0 ? trimmed : undefined);
        return {
          installed: true,
          ...(version ? { version } : {}),
          supportsDomainFlag: wfSupportsDomainFlag(version),
          supportsIndexes: wfSupportsIndexes(version),
          supportsPublishCompleted: wfSupportsPublishCompleted(version),
        };
      },
      () => {
        this.pending = undefined;
        return { ...WF_CLI_NOT_INSTALLED };
      },
    );
    return this.pending;
  }

  /** Called on every `invalidate()` — tree views re-render their CLI-dependent nodes. */
  onDidInvalidate(listener: () => void): { dispose(): void } {
    this.invalidateListeners.add(listener);
    return {
      dispose: () => {
        this.invalidateListeners.delete(listener);
      },
    };
  }

  invalidate(): void {
    this.pending = undefined;
    for (const listener of [...this.invalidateListeners]) listener();
  }
}
```

In `apps/extension/src/tools/providers/environments-provider.ts` (line ~1269), replace

```ts
    const info = (await this.wfCli?.get()) ?? { installed: true, supportsDomainFlag: false };
```

with

```ts
    const info: WfCliInfo = (await this.wfCli?.get()) ?? {
      installed: true,
      supportsDomainFlag: false,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    };
```

and change the existing import `import type { WfCliProbe } from '../wf-cli-probe.js';` to `import type { WfCliInfo, WfCliProbe } from '../wf-cli-probe.js';`.

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/wf-cli-probe.vitest.test.ts && pnpm --filter vnext-forge-studio exec tsc --noEmit -p tsconfig.json`
Expected: PASS (5 tests); `tsc` prints nothing and exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/tools/wf-cli-probe.ts apps/extension/src/tools/wf-cli-probe.vitest.test.ts apps/extension/src/tools/providers/environments-provider.ts
git commit -m "$(cat <<'EOF'
feat(extension): probe wf CLI for indexes and publish-completed support

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: extension — generalize `WfCliUpgradeNotice` to `(featureName, minVersion)`

**Files:**
- Create: `apps/extension/src/tools/wf-cli-features.ts`
- Modify: `apps/extension/src/tools/wf-cli-upgrade-notice.ts`
- Modify call sites: `apps/extension/src/extension.ts:246` and `:642`, `apps/extension/src/tools/providers/environments-provider.ts:1275`, `apps/extension/src/tools/providers/package-deploy-provider.ts:149`
- Test: `apps/extension/src/tools/wf-cli-features.vitest.test.ts`

**Interfaces:**
- Consumes: `WF_DOMAIN_FLAG_MIN_VERSION`, `WF_INDEXES_MIN_VERSION` (services-core), `WfCliInfo` (Task 3).
- Produces: `interface WfCliFeature { featureName: string; minVersion: string }`; `WF_CLI_FEATURES.domainFlag`, `WF_CLI_FEATURES.indexes`; `wfCliUpgradeMessage(version: string | undefined, feature: WfCliFeature): string`; `WfCliUpgradeNotice.maybeShow(info: WfCliInfo, feature: WfCliFeature): Promise<void>` (once per session **per feature**) and `WfCliUpgradeNotice.show(info: WfCliInfo, feature: WfCliFeature): Promise<void>` (always; for explicit user actions).

- [ ] **Step 1: Write the failing tests**

Create `apps/extension/src/tools/wf-cli-features.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { WF_DOMAIN_FLAG_MIN_VERSION, WF_INDEXES_MIN_VERSION } from '@vnext-forge-studio/services-core';

import { WF_CLI_FEATURES, wfCliUpgradeMessage } from './wf-cli-features.js';

describe('WF_CLI_FEATURES', () => {
  it('takes every floor from services-core', () => {
    expect(WF_CLI_FEATURES.domainFlag.minVersion).toBe(WF_DOMAIN_FLAG_MIN_VERSION);
    expect(WF_CLI_FEATURES.indexes.minVersion).toBe(WF_INDEXES_MIN_VERSION);
  });
});

describe('wfCliUpgradeMessage', () => {
  it('names the feature, the installed version and the floor', () => {
    expect(wfCliUpgradeMessage('1.0.13', WF_CLI_FEATURES.indexes)).toBe(
      'Workflow CLI 1.0.13 does not support index SQL generation (wf indexes generate). Update to 1.1.0 or newer.',
    );
    expect(wfCliUpgradeMessage('1.0.12', WF_CLI_FEATURES.domainFlag)).toBe(
      'Workflow CLI 1.0.12 does not support the --domain option, so Forge is using the legacy ' +
        '"wf domain use <domain> && …" form. Update to 1.0.13 or newer.',
    );
  });

  it('handles an unknown version', () => {
    expect(wfCliUpgradeMessage(undefined, { featureName: 'X', minVersion: '9.9.9' })).toBe(
      'Workflow CLI (unknown version) does not support X. Update to 9.9.9 or newer.',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/wf-cli-features.vitest.test.ts`
Expected: FAIL — `Failed to load url ./wf-cli-features.js`.

- [ ] **Step 3: Implement the pure module**

Create `apps/extension/src/tools/wf-cli-features.ts`:

```ts
import { WF_DOMAIN_FLAG_MIN_VERSION, WF_INDEXES_MIN_VERSION } from '@vnext-forge-studio/services-core';

/** A Workflow CLI capability that needs a minimum CLI version. */
export interface WfCliFeature {
  /** Completes "Workflow CLI <version> does not support …". */
  featureName: string;
  minVersion: string;
}

export const WF_CLI_FEATURES = {
  domainFlag: {
    featureName: 'the --domain option, so Forge is using the legacy "wf domain use <domain> && …" form',
    minVersion: WF_DOMAIN_FLAG_MIN_VERSION,
  },
  indexes: {
    featureName: 'index SQL generation (wf indexes generate)',
    minVersion: WF_INDEXES_MIN_VERSION,
  },
} as const satisfies Record<string, WfCliFeature>;

export function wfCliUpgradeMessage(version: string | undefined, feature: WfCliFeature): string {
  return (
    `Workflow CLI ${version ?? '(unknown version)'} does not support ${feature.featureName}. ` +
    `Update to ${feature.minVersion} or newer.`
  );
}
```

- [ ] **Step 4: Rewrite the notice**

Replace `apps/extension/src/tools/wf-cli-upgrade-notice.ts` with:

```ts
import * as vscode from 'vscode';

import { wfCliUpgradeMessage, type WfCliFeature } from './wf-cli-features.js';
import type { WfCliInfo } from './wf-cli-probe.js';

const UPDATE_ACTION = 'Update Workflow CLI';

/**
 * "Your Workflow CLI is too old for <feature>" notification with an update
 * action. `maybeShow` is for automatic fallbacks (at most once per session and
 * feature); `show` is for an explicit user action that cannot run at all.
 */
export class WfCliUpgradeNotice {
  private readonly shown = new Set<string>();

  constructor(private readonly install: () => Promise<void>) {}

  async maybeShow(info: WfCliInfo, feature: WfCliFeature): Promise<void> {
    if (this.shown.has(feature.featureName)) return;
    this.shown.add(feature.featureName);
    await this.show(info, feature);
  }

  async show(info: WfCliInfo, feature: WfCliFeature): Promise<void> {
    const action = await vscode.window.showWarningMessage(
      wfCliUpgradeMessage(info.version, feature),
      UPDATE_ACTION,
    );
    if (action === UPDATE_ACTION) {
      await this.install();
    }
  }
}
```

- [ ] **Step 5: Update the four call sites**

`apps/extension/src/extension.ts`: add `import { WF_CLI_FEATURES } from './tools/wf-cli-features.js';` after the `WfCliUpgradeNotice` import, then replace

```ts
    onLegacyWfCli: (info) => void wfCliUpgradeNotice.maybeShow(info),
```

with

```ts
    onLegacyWfCli: (info) => void wfCliUpgradeNotice.maybeShow(info, WF_CLI_FEATURES.domainFlag),
```

and replace

```ts
        onLegacyCli: (info) => void wfCliUpgradeNotice.maybeShow(info),
```

with

```ts
        onLegacyCli: (info) => void wfCliUpgradeNotice.maybeShow(info, WF_CLI_FEATURES.domainFlag),
```

`apps/extension/src/tools/providers/environments-provider.ts`: add `import { WF_CLI_FEATURES } from '../wf-cli-features.js';` next to the `wf-cli-upgrade-notice` import and replace `void this.legacyNotice?.maybeShow(info);` with `void this.legacyNotice?.maybeShow(info, WF_CLI_FEATURES.domainFlag);`.

`apps/extension/src/tools/providers/package-deploy-provider.ts`: add `import { WF_CLI_FEATURES } from '../wf-cli-features.js';` next to the `wf-cli-upgrade-notice` import and replace `void this.upgradeNotice.maybeShow(info);` with `void this.upgradeNotice.maybeShow(info, WF_CLI_FEATURES.domainFlag);`.

Then confirm no call site was missed:

Run: `grep -rn "maybeShow(info)" apps/extension/src`
Expected: no output.

- [ ] **Step 6: Run the tests and the type check**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/wf-cli-features.vitest.test.ts && pnpm --filter vnext-forge-studio exec tsc --noEmit -p tsconfig.json`
Expected: PASS (3 tests); `tsc` exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/src/tools/wf-cli-features.ts apps/extension/src/tools/wf-cli-features.vitest.test.ts apps/extension/src/tools/wf-cli-upgrade-notice.ts apps/extension/src/extension.ts apps/extension/src/tools/providers/environments-provider.ts apps/extension/src/tools/providers/package-deploy-provider.ts
git commit -m "$(cat <<'EOF'
refactor(extension): generalize the wf CLI upgrade notice per feature

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: extension — Package Deploy publish-completed info node

**Files:**
- Create: `apps/extension/src/tools/providers/package-deploy-nodes.ts`
- Modify: `apps/extension/src/tools/providers/package-deploy-provider.ts`
- Test: `apps/extension/src/tools/providers/package-deploy-nodes.vitest.test.ts`

**Interfaces:**
- Consumes: `WfCliInfo` (Task 3), `WF_PUBLISH_COMPLETED_MIN_VERSION` (Task 1).
- Produces: `type DeployCommandId = 'wfUpdateAll' | 'wfUpdate' | 'wfCsxAll'`, `type DeployNodeId = DeployCommandId | 'installWfCli' | 'publishCompletedInfo'`, `DEPLOY_COMMAND_IDS`, `PUBLISH_COMPLETED_NOTICE: string`, `packageDeployNodeIds(info: WfCliInfo): DeployNodeId[]`. `PackageDeployProvider.runDeployAction` now takes `DeployCommandId | 'installWfCli'`.

- [ ] **Step 1: Write the failing tests**

Create `apps/extension/src/tools/providers/package-deploy-nodes.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { WF_CLI_NOT_INSTALLED, type WfCliInfo } from '../wf-cli-probe.js';
import { packageDeployNodeIds, PUBLISH_COMPLETED_NOTICE } from './package-deploy-nodes.js';

const cli = (version: string, supportsPublishCompleted: boolean): WfCliInfo => ({
  installed: true,
  version,
  supportsDomainFlag: true,
  supportsIndexes: supportsPublishCompleted,
  supportsPublishCompleted,
});

describe('packageDeployNodeIds', () => {
  it('offers only the install node when the CLI is missing', () => {
    expect(packageDeployNodeIds(WF_CLI_NOT_INSTALLED)).toEqual(['installWfCli']);
  });

  it('appends the publish-completed info node for a CLI below 1.1.0', () => {
    expect(packageDeployNodeIds(cli('1.0.13', false))).toEqual([
      'wfUpdateAll',
      'wfUpdate',
      'wfCsxAll',
      'publishCompletedInfo',
    ]);
  });

  it('shows only the deploy actions for a current CLI', () => {
    expect(packageDeployNodeIds(cli('1.1.0', true))).toEqual(['wfUpdateAll', 'wfUpdate', 'wfCsxAll']);
  });

  it('uses the spec wording for the notice', () => {
    expect(PUBLISH_COMPLETED_NOTICE).toBe(
      'This CLI does not signal publish-completed; the runtime discovery cache may stay stale.',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/providers/package-deploy-nodes.vitest.test.ts`
Expected: FAIL — `Failed to load url ./package-deploy-nodes.js`.

- [ ] **Step 3: Implement the pure module**

Create `apps/extension/src/tools/providers/package-deploy-nodes.ts`:

```ts
import type { WfCliInfo } from '../wf-cli-probe.js';

export type DeployCommandId = 'wfUpdateAll' | 'wfUpdate' | 'wfCsxAll';
export type DeployNodeId = DeployCommandId | 'installWfCli' | 'publishCompletedInfo';

export const DEPLOY_COMMAND_IDS: readonly DeployCommandId[] = ['wfUpdateAll', 'wfUpdate', 'wfCsxAll'];

export const PUBLISH_COMPLETED_NOTICE =
  'This CLI does not signal publish-completed; the runtime discovery cache may stay stale.';

/** Package Deploy tree roots for the probed CLI. */
export function packageDeployNodeIds(info: WfCliInfo): DeployNodeId[] {
  if (!info.installed) return ['installWfCli'];
  return info.supportsPublishCompleted
    ? [...DEPLOY_COMMAND_IDS]
    : [...DEPLOY_COMMAND_IDS, 'publishCompletedInfo'];
}
```

- [ ] **Step 4: Wire it into the provider**

In `apps/extension/src/tools/providers/package-deploy-provider.ts`:

1. Change the services-core import to:

```ts
import {
  buildWfShellCommand,
  WF_PUBLISH_COMPLETED_MIN_VERSION,
  type VnextSolutionFile,
  type WfWorkspaceCommand,
} from '@vnext-forge-studio/services-core';
```

2. Replace the two local type aliases

```ts
type DeployNodeId = 'wfUpdateAll' | 'wfUpdate' | 'wfCsxAll' | 'installWfCli';
type DeployCommandId = Exclude<DeployNodeId, 'installWfCli'>;
```

with

```ts
import {
  packageDeployNodeIds,
  PUBLISH_COMPLETED_NOTICE,
  type DeployCommandId,
  type DeployNodeId,
} from './package-deploy-nodes.js';
```

(move this import up so it sits with the other relative imports, after the `wf-cli-upgrade-notice` import).

3. In `interface DeployAction`, change `id: DeployNodeId;` to `id: DeployCommandId | 'installWfCli';`.

4. At the start of `getTreeItem`, before `const action = …`, insert:

```ts
    if (element === 'publishCompletedInfo') {
      const notice = new vscode.TreeItem('Discovery cache may stay stale', vscode.TreeItemCollapsibleState.None);
      notice.description = `Workflow CLI < ${WF_PUBLISH_COMPLETED_MIN_VERSION}`;
      notice.tooltip = `${PUBLISH_COMPLETED_NOTICE} Update the Workflow CLI to ${WF_PUBLISH_COMPLETED_MIN_VERSION} or newer.`;
      notice.iconPath = new vscode.ThemeIcon('info');
      notice.command = { command: 'vnextForge.tools.installWfCli', title: 'Update Workflow CLI' };
      return notice;
    }
```

5. Replace the body of `getChildren` with:

```ts
    if (element) return [];
    return packageDeployNodeIds(await this.wfCli.get());
```

6. Change the signature `async runDeployAction(actionId: DeployNodeId): Promise<void> {` to `async runDeployAction(actionId: DeployCommandId | 'installWfCli'): Promise<void> {`.

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/providers/package-deploy-nodes.vitest.test.ts && pnpm --filter vnext-forge-studio exec tsc --noEmit -p tsconfig.json`
Expected: PASS (4 tests); `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/src/tools/providers/package-deploy-nodes.ts apps/extension/src/tools/providers/package-deploy-nodes.vitest.test.ts apps/extension/src/tools/providers/package-deploy-provider.ts
git commit -m "$(cat <<'EOF'
feat(extension): warn in Package Deploy when the CLI lacks publish-completed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: extension — captured `wf` run

**Files:**
- Create: `apps/extension/src/tools/wf-captured-run.ts`
- Test: `apps/extension/src/tools/wf-captured-run.vitest.test.ts`

**Interfaces:**
- Consumes: `buildChildEnv`, `DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST` (services-core).
- Produces: `interface WfCapturedResult { exitCode: number | null; stdout: string; stderr: string; errorMessage?: string }`, `type WfExecFileFn`, `runWfCaptured(argv: readonly string[], opts: { cwd: string; timeoutMs: number }, exec?: WfExecFileFn): Promise<WfCapturedResult>` — never rejects.

- [ ] **Step 1: Write the failing tests**

Create `apps/extension/src/tools/wf-captured-run.vitest.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runWfCaptured, type WfExecFileFn } from './wf-captured-run.js';

type ExecError = Parameters<Parameters<WfExecFileFn>[3]>[0];

function fakeExec(error: ExecError, stdout = '', stderr = '') {
  return vi.fn<WfExecFileFn>((_file, _args, _options, callback) => callback(error, stdout, stderr));
}

afterEach(() => {
  delete process.env.VNEXT_FORGE_TEST_SECRET;
});

describe('runWfCaptured', () => {
  it('runs wf with the argv, cwd, timeout and an allowlisted env', async () => {
    process.env.VNEXT_FORGE_TEST_SECRET = 'leak';
    const exec = fakeExec(null, '  ✓ Generated 1 SQL file(s): /ws/index-sql/b\n');
    const result = await runWfCaptured(['indexes', 'generate'], { cwd: '/ws', timeoutMs: 1000 }, exec);
    expect(result).toEqual({ exitCode: 0, stdout: '  ✓ Generated 1 SQL file(s): /ws/index-sql/b\n', stderr: '' });
    const [file, args, options] = exec.mock.calls[0]!;
    expect(file).toBe('wf');
    expect(args).toEqual(['indexes', 'generate']);
    expect(options.cwd).toBe('/ws');
    expect(options.timeout).toBe(1000);
    expect(options.shell).toBe(process.platform === 'win32');
    expect(options.env.VNEXT_FORGE_TEST_SECRET).toBeUndefined();
    expect(options.env.PATH).toBe(process.env.PATH);
  });

  it('resolves a non-zero exit with the captured output', async () => {
    const error = Object.assign(new Error('Command failed'), { code: 1 });
    const result = await runWfCaptured(['indexes', 'generate'], { cwd: '/ws', timeoutMs: 1000 }, fakeExec(error, '  ✗ boom\n'));
    expect(result).toEqual({ exitCode: 1, stdout: '  ✗ boom\n', stderr: '' });
  });

  it('explains a missing binary', async () => {
    const error = Object.assign(new Error('spawn wf ENOENT'), { code: 'ENOENT' });
    const result = await runWfCaptured(['indexes', 'generate'], { cwd: '/ws', timeoutMs: 1000 }, fakeExec(error));
    expect(result).toEqual({
      exitCode: null,
      stdout: '',
      stderr: '',
      errorMessage: 'The Workflow CLI (wf) was not found on PATH.',
    });
  });

  it('explains a timeout', async () => {
    const error = Object.assign(new Error('killed'), { code: null, killed: true });
    const result = await runWfCaptured(['indexes', 'generate'], { cwd: '/ws', timeoutMs: 300_000 }, fakeExec(error));
    expect(result.exitCode).toBeNull();
    expect(result.errorMessage).toBe('The Workflow CLI did not finish within 300s.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/wf-captured-run.vitest.test.ts`
Expected: FAIL — `Failed to load url ./wf-captured-run.js`.

- [ ] **Step 3: Implement**

Create `apps/extension/src/tools/wf-captured-run.ts`:

```ts
import { execFile } from 'node:child_process';

import { buildChildEnv, DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST } from '@vnext-forge-studio/services-core';

/**
 * Captured (non-terminal) Workflow CLI run for commands whose result Forge must
 * parse and that never prompt (`wf indexes generate`). No stdin is attached, so
 * an interactive command would hang until the timeout — do not use this for
 * `wf update` / `wf reset`, which stay in the Forge terminal.
 *
 * On Windows `wf` is a `.cmd` shim, so `shell` is on there (same as
 * `execFileWfVersion`); argv must then hold only shell-safe tokens (flow keys
 * are validated by `buildWfIndexesGenerateArgv`).
 */
export interface WfCapturedResult {
  /** Process exit code; `null` when the process could not start or was killed. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Why there is no exit code (binary missing, timeout). */
  errorMessage?: string;
}

export interface WfExecOptions {
  cwd: string;
  timeout: number;
  shell: boolean;
  env: NodeJS.ProcessEnv;
  encoding: 'utf8';
  maxBuffer: number;
  windowsHide: boolean;
}

export type WfExecFileFn = (
  file: string,
  args: readonly string[],
  options: WfExecOptions,
  callback: (error: (Error & { code?: unknown; killed?: boolean }) | null, stdout: string, stderr: string) => void,
) => void;

const defaultExec: WfExecFileFn = (file, args, options, callback) => {
  execFile(file, [...args], options, (error, stdout, stderr) => {
    callback(error, String(stdout), String(stderr));
  });
};

export function runWfCaptured(
  argv: readonly string[],
  opts: { cwd: string; timeoutMs: number },
  exec: WfExecFileFn = defaultExec,
): Promise<WfCapturedResult> {
  return new Promise((resolve) => {
    exec(
      'wf',
      argv,
      {
        cwd: opts.cwd,
        timeout: opts.timeoutMs,
        shell: process.platform === 'win32',
        env: buildChildEnv(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ exitCode: 0, stdout, stderr });
          return;
        }
        if (typeof error.code === 'number') {
          resolve({ exitCode: error.code, stdout, stderr });
          return;
        }
        const errorMessage = error.killed
          ? `The Workflow CLI did not finish within ${Math.round(opts.timeoutMs / 1000)}s.`
          : error.code === 'ENOENT'
            ? 'The Workflow CLI (wf) was not found on PATH.'
            : error.message;
        resolve({ exitCode: null, stdout, stderr, errorMessage });
      },
    );
  });
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/wf-captured-run.vitest.test.ts && pnpm --filter vnext-forge-studio exec tsc --noEmit -p tsconfig.json`
Expected: PASS (4 tests); `tsc` exits 0. If `tsc` rejects passing Node's `ExecFileException` to the callback, widen only the `defaultExec` call with `callback(error as (Error & { code?: unknown; killed?: boolean }) | null, …)` — do not change `WfExecFileFn`.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/tools/wf-captured-run.ts apps/extension/src/tools/wf-captured-run.vitest.test.ts
git commit -m "$(cat <<'EOF'
feat(extension): captured wf run with allowlisted child env

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: extension — index SQL plan (nodes, solution check, flows, batch paths)

**Files:**
- Create: `apps/extension/src/tools/index-sql/index-sql-plan.ts`
- Test: `apps/extension/src/tools/index-sql/index-sql-plan.vitest.test.ts`

**Interfaces:**
- Consumes: `isValidWfFlowKey`, `VnextSolutionFile` (services-core), `DiscoveredVnextComponent` (`@vnext-forge-studio/app-contracts`), `WfCliInfo` (Task 3).
- Produces:
  - `type DatabaseNodeId = 'generateIndexSqlAll' | 'generateIndexSqlForFlow' | 'installWfCli' | 'updateWfCli'`; `databaseNodeIds(info: WfCliInfo): DatabaseNodeId[]`
  - `type IndexSqlSolution = VnextSolutionFile & { config: NonNullable<VnextSolutionFile['config']> }`
  - `type IndexSqlSolutionCheck = { kind: 'ready'; solution: IndexSqlSolution } | { kind: 'pickSolution'; solutions: IndexSqlSolution[] } | { kind: 'nonDefault'; chosen: IndexSqlSolution; fallback: IndexSqlSolution } | { kind: 'noDefault' }`; `checkIndexSqlSolution(solutions: readonly VnextSolutionFile[], chosenFileName?: string): IndexSqlSolutionCheck`
  - `interface IndexSqlFlow { key: string; path: string }`; `listIndexSqlFlows(workflows: readonly DiscoveredVnextComponent[], domain: string): IndexSqlFlow[]`
  - `resolveIndexSqlBatch(cwd: string, batchPath: string): { batchDir: string; readmePath: string }`
  - Copy: `NO_DEFAULT_SOLUTION_MESSAGE`, `RETIRE_OBSOLETE_WARNING`, `nonDefaultSolutionWarning(chosen, fallback): string`, `indexSqlSuccessMessage(count: number, batchDir: string, cwd: string): string`

- [ ] **Step 1: Write the failing tests**

Create `apps/extension/src/tools/index-sql/index-sql-plan.vitest.test.ts`:

```ts
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type { VnextSolutionFile } from '@vnext-forge-studio/services-core';

import { WF_CLI_NOT_INSTALLED, type WfCliInfo } from '../wf-cli-probe.js';
import {
  checkIndexSqlSolution,
  databaseNodeIds,
  indexSqlSuccessMessage,
  listIndexSqlFlows,
  nonDefaultSolutionWarning,
  resolveIndexSqlBatch,
  type IndexSqlSolution,
} from './index-sql-plan.js';

type SolutionConfig = NonNullable<VnextSolutionFile['config']>;

function solution(fileName: string, domain: string, ok = true): VnextSolutionFile {
  const isDefault = fileName === 'vnext.config.json';
  const config = { domain, paths: { componentsRoot: domain } } as unknown as SolutionConfig;
  return {
    fileName,
    filePath: `/ws/${fileName}`,
    rootPath: '/ws',
    isDefault,
    ...(isDefault ? {} : { domainFromFileName: domain }),
    ...(ok
      ? { status: { status: 'ok' as const, config }, config }
      : { status: { status: 'invalid' as const, message: 'bad json' } }),
  };
}

const cli = (supportsIndexes: boolean): WfCliInfo => ({
  installed: true,
  version: supportsIndexes ? '1.1.0' : '1.0.13',
  supportsDomainFlag: true,
  supportsIndexes,
  supportsPublishCompleted: supportsIndexes,
});

describe('databaseNodeIds', () => {
  it('asks to install, then to update, then offers both actions', () => {
    expect(databaseNodeIds(WF_CLI_NOT_INSTALLED)).toEqual(['installWfCli']);
    expect(databaseNodeIds(cli(false))).toEqual(['updateWfCli']);
    expect(databaseNodeIds(cli(true))).toEqual(['generateIndexSqlAll', 'generateIndexSqlForFlow']);
  });
});

describe('checkIndexSqlSolution', () => {
  const core = solution('vnext.config.json', 'core');
  const partner = solution('vnext.partner.config.json', 'partner');

  it('is ready with only the default solution', () => {
    expect(checkIndexSqlSolution([core])).toEqual({ kind: 'ready', solution: core });
    expect(checkIndexSqlSolution([core, solution('vnext.broken.config.json', 'broken', false)])).toEqual({
      kind: 'ready',
      solution: core,
    });
  });

  it('refuses a root without a valid vnext.config.json', () => {
    expect(checkIndexSqlSolution([partner])).toEqual({ kind: 'noDefault' });
    expect(checkIndexSqlSolution([solution('vnext.config.json', 'core', false), partner])).toEqual({
      kind: 'noDefault',
    });
  });

  it('asks for a solution when several are valid', () => {
    expect(checkIndexSqlSolution([core, partner])).toEqual({ kind: 'pickSolution', solutions: [core, partner] });
  });

  it('flags a chosen domain-suffixed solution and offers the default instead', () => {
    expect(checkIndexSqlSolution([core, partner], 'VNEXT.PARTNER.CONFIG.JSON')).toEqual({
      kind: 'nonDefault',
      chosen: partner,
      fallback: core,
    });
    expect(checkIndexSqlSolution([core, partner], 'vnext.config.json')).toEqual({ kind: 'ready', solution: core });
  });

  it('words the multi-domain warning around the default solution', () => {
    expect(nonDefaultSolutionWarning(partner as IndexSqlSolution, core as IndexSqlSolution)).toBe(
      'The Workflow CLI only processes the default solution (vnext.config.json, domain "core"). ' +
        'vnext.partner.config.json (domain "partner") is not included. Generate index SQL for "core" instead?',
    );
  });
});

describe('listIndexSqlFlows', () => {
  const row = (key: string, domain: string | undefined, flow = 'sys-flows'): DiscoveredVnextComponent => ({
    key,
    path: `/ws/core/Workflows/${key}.json`,
    flow,
    ...(domain ? { domain } : {}),
  });

  it('keeps valid local workflow keys of the domain, sorted and unique', () => {
    expect(
      listIndexSqlFlows(
        [
          row('money-transfer', 'core'),
          row('account-opening', 'core'),
          row('account-opening', 'core'),
          row('partner-flow', 'partner'),
          row('no-domain', undefined),
          row('1-bad-key', 'core'),
          row('some-task', 'core', 'sys-tasks'),
        ],
        'core',
      ),
    ).toEqual([
      { key: 'account-opening', path: '/ws/core/Workflows/account-opening.json' },
      { key: 'money-transfer', path: '/ws/core/Workflows/money-transfer.json' },
    ]);
  });
});

describe('batch paths and copy', () => {
  it('resolves the batch folder against the run folder and points at README.txt', () => {
    expect(resolveIndexSqlBatch('/ws', '/ws/index-sql/b1')).toEqual({
      batchDir: path.resolve('/ws/index-sql/b1'),
      readmePath: path.join(path.resolve('/ws/index-sql/b1'), 'README.txt'),
    });
    expect(resolveIndexSqlBatch('/ws', 'index-sql/b2').batchDir).toBe(path.resolve('/ws', 'index-sql/b2'));
  });

  it('shows the batch relative to the workspace when it is inside it', () => {
    expect(indexSqlSuccessMessage(3, path.resolve('/ws/index-sql/b1'), path.resolve('/ws'))).toBe(
      `Generated 3 SQL file(s) in ${path.join('index-sql', 'b1')}. Nothing was executed; hand the batch to your DBA for review.`,
    );
    expect(indexSqlSuccessMessage(1, path.resolve('/elsewhere/b'), path.resolve('/ws'))).toBe(
      `Generated 1 SQL file(s) in ${path.resolve('/elsewhere/b')}. Nothing was executed; hand the batch to your DBA for review.`,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/index-sql/index-sql-plan.vitest.test.ts`
Expected: FAIL — `Failed to load url ./index-sql-plan.js`.

- [ ] **Step 3: Implement**

Create `apps/extension/src/tools/index-sql/index-sql-plan.ts`:

```ts
import * as path from 'node:path';

import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { isValidWfFlowKey, type VnextSolutionFile } from '@vnext-forge-studio/services-core';

import type { WfCliInfo } from '../wf-cli-probe.js';

/**
 * Pure decisions behind the Forge Tools "Database" view (`wf indexes generate`).
 * No `vscode` import — the glue lives in `providers/database-provider.ts`.
 */

export type DatabaseNodeId = 'generateIndexSqlAll' | 'generateIndexSqlForFlow' | 'installWfCli' | 'updateWfCli';

export function databaseNodeIds(info: WfCliInfo): DatabaseNodeId[] {
  if (!info.installed) return ['installWfCli'];
  if (!info.supportsIndexes) return ['updateWfCli'];
  return ['generateIndexSqlAll', 'generateIndexSqlForFlow'];
}

export type IndexSqlSolution = VnextSolutionFile & { config: NonNullable<VnextSolutionFile['config']> };

export type IndexSqlSolutionCheck =
  | { kind: 'ready'; solution: IndexSqlSolution }
  | { kind: 'pickSolution'; solutions: IndexSqlSolution[] }
  | { kind: 'nonDefault'; chosen: IndexSqlSolution; fallback: IndexSqlSolution }
  | { kind: 'noDefault' };

function isUsableSolution(solution: VnextSolutionFile): solution is IndexSqlSolution {
  return solution.status.status === 'ok' && !!solution.config;
}

/**
 * `wf indexes generate` reads only `vnext.config.json` in cwd and ignores
 * `--domain`, so only the default solution can be processed. With several
 * valid solutions the user picks one first (`pickSolution`); picking a
 * domain-suffixed one yields `nonDefault` so the caller can warn and offer the
 * default instead.
 */
export function checkIndexSqlSolution(
  solutions: readonly VnextSolutionFile[],
  chosenFileName?: string,
): IndexSqlSolutionCheck {
  const usable = solutions.filter(isUsableSolution);
  const fallback = usable.find((solution) => solution.isDefault);
  if (!fallback) return { kind: 'noDefault' };
  if (chosenFileName === undefined) {
    return usable.length > 1 ? { kind: 'pickSolution', solutions: usable } : { kind: 'ready', solution: fallback };
  }
  const wanted = chosenFileName.toLowerCase();
  const chosen = usable.find((solution) => solution.fileName.toLowerCase() === wanted);
  if (!chosen || chosen.isDefault) return { kind: 'ready', solution: fallback };
  return { kind: 'nonDefault', chosen, fallback };
}

export interface IndexSqlFlow {
  key: string;
  path: string;
}

/**
 * Local workflows the CLI would accept for `--flow`: `sys-flows` components of
 * the solution's domain whose key passes the CLI flow-key rule.
 */
export function listIndexSqlFlows(workflows: readonly DiscoveredVnextComponent[], domain: string): IndexSqlFlow[] {
  const byKey = new Map<string, IndexSqlFlow>();
  for (const row of workflows) {
    if (row.flow !== 'sys-flows' || row.domain !== domain || !isValidWfFlowKey(row.key)) continue;
    if (!byKey.has(row.key)) byKey.set(row.key, { key: row.key, path: row.path });
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** The CLI prints an absolute batch path; a relative one is resolved against the run folder. */
export function resolveIndexSqlBatch(cwd: string, batchPath: string): { batchDir: string; readmePath: string } {
  const batchDir = path.resolve(cwd, batchPath);
  return { batchDir, readmePath: path.join(batchDir, 'README.txt') };
}

export const NO_DEFAULT_SOLUTION_MESSAGE =
  'Index SQL generation needs a valid vnext.config.json in the workspace root: the Workflow CLI only processes the default solution.';

export const RETIRE_OBSOLETE_WARNING =
  'Retiring obsolete projections requires every still-active workflow version to be present locally and ' +
  'runtime readers/writers to be drained during the maintenance. Stored values and columns are kept. Continue?';

export function nonDefaultSolutionWarning(chosen: IndexSqlSolution, fallback: IndexSqlSolution): string {
  return (
    `The Workflow CLI only processes the default solution (vnext.config.json, domain "${fallback.config.domain}"). ` +
    `${chosen.fileName} (domain "${chosen.config.domain}") is not included. ` +
    `Generate index SQL for "${fallback.config.domain}" instead?`
  );
}

export function indexSqlSuccessMessage(count: number, batchDir: string, cwd: string): string {
  const relative = path.relative(cwd, batchDir);
  const shown = relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : batchDir;
  return `Generated ${count} SQL file(s) in ${shown}. Nothing was executed; hand the batch to your DBA for review.`;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/index-sql/index-sql-plan.vitest.test.ts && pnpm --filter vnext-forge-studio exec tsc --noEmit -p tsconfig.json`
Expected: PASS (9 tests); `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/tools/index-sql/index-sql-plan.ts apps/extension/src/tools/index-sql/index-sql-plan.vitest.test.ts
git commit -m "$(cat <<'EOF'
feat(extension): index SQL plan for the default solution and local flows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: extension — Database tree view, commands and contributes

**Files:**
- Create: `apps/extension/src/tools/providers/database-provider.ts`
- Modify: `apps/extension/src/extension.ts` (import block; after `packageDeployProvider` construction ~line 369; `createTreeView` block ~line 382; commands after `vnextForge.tools.installWfCli` ~line 518)
- Modify: `apps/extension/package.json` (`activationEvents`, `contributes.views.vnextForgeTools`, `contributes.commands`, `menus.commandPalette`, `menus["view/title"]`)
- Test: `apps/extension/src/tools/index-sql/database-contributes.vitest.test.ts`

**Interfaces:**
- Consumes: `buildWfIndexesGenerateArgv`, `parseWfIndexesGenerateOutput`, `WF_INDEXES_MIN_VERSION`, `scanVnextComponents`, `FileSystemAdapter`, `VnextSolutionFile` (services-core); `runWfCaptured`, `WfCapturedResult` (Task 6); everything in `index-sql-plan.ts` (Task 7); `WF_CLI_FEATURES`, `wfCliUpgradeMessage` (Task 4); `WfCliProbe.onDidInvalidate` (Task 3); `WfCliUpgradeNotice.show` (Task 4); `pickWorkspaceRoot` (existing).
- Produces: `class DatabaseProvider implements vscode.TreeDataProvider<DatabaseNodeId>, vscode.Disposable` with `generateIndexSql(scope: 'all' | 'flow'): Promise<void>`; commands `vnextForge.tools.generateIndexSqlAll`, `vnextForge.tools.generateIndexSqlForFlow`, `vnextForge.tools.refreshWfCliStatus`; view `vnextForge.tools.database`.

- [ ] **Step 1: Write the failing wiring test**

Create `apps/extension/src/tools/index-sql/database-contributes.vitest.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface ContributedCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string;
}
interface MenuEntry {
  command: string;
  when?: string;
  group?: string;
}

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8')) as {
  activationEvents: string[];
  contributes: {
    views: Record<string, { id: string; name: string; when?: string }[]>;
    commands: ContributedCommand[];
    menus: Record<string, MenuEntry[]>;
  };
};
const extensionSource = readFileSync(fileURLToPath(new URL('../../extension.ts', import.meta.url)), 'utf8');

const NEW_COMMANDS = [
  'vnextForge.tools.generateIndexSqlAll',
  'vnextForge.tools.generateIndexSqlForFlow',
  'vnextForge.tools.refreshWfCliStatus',
];

describe('Database view contributes', () => {
  it('declares the view in the Forge Tools container for vNext workspaces', () => {
    expect(pkg.contributes.views.vnextForgeTools).toContainEqual({
      id: 'vnextForge.tools.database',
      name: 'Database',
      when: 'vnextForge.isVnextWorkspace',
    });
    expect(pkg.activationEvents).toContain('onView:vnextForge.tools.database');
    expect(extensionSource).toContain("createTreeView('vnextForge.tools.database'");
  });

  it('contributes, exposes and registers every new command', () => {
    for (const id of NEW_COMMANDS) {
      const command = pkg.contributes.commands.find((c) => c.command === id);
      expect(command, id).toBeDefined();
      expect(command?.category).toBe('Forge');
      expect(command?.icon).toMatch(/^\$\([a-z-]+\)$/);
      expect(pkg.contributes.menus.commandPalette).toContainEqual({
        command: id,
        when: 'vnextForge.isVnextWorkspace',
      });
      expect(extensionSource).toContain(`registerCommand('${id}'`);
    }
  });

  it('puts the refresh button on the Database and Package Deploy views', () => {
    expect(pkg.contributes.menus['view/title']).toContainEqual({
      command: 'vnextForge.tools.refreshWfCliStatus',
      when: 'view == vnextForge.tools.database || view == vnextForge.tools.packageDeploy',
      group: 'navigation',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/index-sql/database-contributes.vitest.test.ts`
Expected: FAIL — the `vnextForge.tools.database` view is missing.

- [ ] **Step 3: Create the provider**

Create `apps/extension/src/tools/providers/database-provider.ts`:

```ts
import * as vscode from 'vscode';

import {
  buildWfIndexesGenerateArgv,
  parseWfIndexesGenerateOutput,
  scanVnextComponents,
  WF_INDEXES_MIN_VERSION,
  type FileSystemAdapter,
} from '@vnext-forge-studio/services-core';

import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from '../../workspace-detector.js';
import {
  checkIndexSqlSolution,
  databaseNodeIds,
  indexSqlSuccessMessage,
  listIndexSqlFlows,
  NO_DEFAULT_SOLUTION_MESSAGE,
  nonDefaultSolutionWarning,
  resolveIndexSqlBatch,
  RETIRE_OBSOLETE_WARNING,
  type DatabaseNodeId,
  type IndexSqlSolution,
} from '../index-sql/index-sql-plan.js';
import { pickWorkspaceRoot } from '../pick-workspace-root.js';
import { runWfCaptured, type WfCapturedResult } from '../wf-captured-run.js';
import { WF_CLI_FEATURES, wfCliUpgradeMessage } from '../wf-cli-features.js';
import type { WfCliProbe } from '../wf-cli-probe.js';
import type { WfCliUpgradeNotice } from '../wf-cli-upgrade-notice.js';

const INDEX_SQL_TIMEOUT_MS = 5 * 60_000;
const OPEN_README = 'Open README.txt';
const SHOW_OUTPUT = 'Show Output';
const RETIRE_CONFIRM = 'Retire Obsolete Projections';

export interface DatabaseProviderDeps {
  detector: VnextWorkspaceDetector;
  fs: FileSystemAdapter;
  wfCli: WfCliProbe;
  upgradeNotice: WfCliUpgradeNotice;
  output: vscode.OutputChannel;
  installWfCli: () => Promise<void>;
  runWf?: (argv: readonly string[], opts: { cwd: string; timeoutMs: number }) => Promise<WfCapturedResult>;
}

/**
 * Forge Tools "Database" view: offline attribute-index SQL through
 * `wf indexes generate` (Workflow CLI ≥ 1.1.0). Decisions live in
 * `index-sql-plan.ts`; this class only renders nodes and drives the prompts.
 */
export class DatabaseProvider implements vscode.TreeDataProvider<DatabaseNodeId>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<DatabaseNodeId | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private readonly probeSubscription: { dispose(): void };
  private running = false;

  constructor(private readonly deps: DatabaseProviderDeps) {
    this.probeSubscription = deps.wfCli.onDidInvalidate(() => this._onDidChangeTreeData.fire(undefined));
  }

  dispose(): void {
    this.probeSubscription.dispose();
    this._onDidChangeTreeData.dispose();
  }

  async getTreeItem(element: DatabaseNodeId): Promise<vscode.TreeItem> {
    switch (element) {
      case 'generateIndexSqlAll':
        return this.item('Generate Index SQL (all flows)', 'wf indexes generate', 'database', 'vnextForge.tools.generateIndexSqlAll');
      case 'generateIndexSqlForFlow':
        return this.item('Generate Index SQL for flow…', 'wf indexes generate --flow', 'filter', 'vnextForge.tools.generateIndexSqlForFlow');
      case 'installWfCli':
        return this.item('Install Workflow CLI', 'npm install -g @burgan-tech/vnext-workflow-cli', 'desktop-download', 'vnextForge.tools.installWfCli');
      case 'updateWfCli': {
        const info = await this.deps.wfCli.get();
        const item = this.item(
          'Update Workflow CLI',
          `requires ${WF_INDEXES_MIN_VERSION}+ (installed ${info.version ?? 'unknown'})`,
          'arrow-circle-up',
          'vnextForge.tools.installWfCli',
        );
        item.tooltip = wfCliUpgradeMessage(info.version, WF_CLI_FEATURES.indexes);
        return item;
      }
    }
  }

  async getChildren(element?: DatabaseNodeId): Promise<DatabaseNodeId[]> {
    if (element) return [];
    return databaseNodeIds(await this.deps.wfCli.get());
  }

  async generateIndexSql(scope: 'all' | 'flow'): Promise<void> {
    const info = await this.deps.wfCli.get();
    if (!info.installed) {
      const action = await vscode.window.showWarningMessage(
        'vnext-forge-studio: Workflow CLI (wf) is not installed.',
        'Install Now',
      );
      if (action === 'Install Now') await this.deps.installWfCli();
      return;
    }
    if (!info.supportsIndexes) {
      await this.deps.upgradeNotice.show(info, WF_CLI_FEATURES.indexes);
      return;
    }

    const roots = this.deps.detector.getRoots();
    if (roots.length === 0) {
      void vscode.window.showWarningMessage('vnext-forge-studio: No vnext workspace found.');
      return;
    }
    const root = await pickWorkspaceRoot(roots, {
      title: 'Generate Index SQL: select vNext workspace',
      placeHolder: 'Several vNext roots are open — pick the one to generate index SQL for.',
    });
    if (!root) return;

    const solution = await this.resolveSolution(root);
    if (!solution) return;

    let flow: string | undefined;
    if (scope === 'flow') {
      flow = await this.pickFlow(root, solution);
      if (!flow) return;
    }

    const retireObsolete = await this.pickRetireObsolete();
    if (retireObsolete === undefined) return;

    const argv = buildWfIndexesGenerateArgv({
      base: 'indexes generate',
      ...(flow ? { flow } : {}),
      retireObsolete,
    });
    await this.run(argv, root.folderPath);
  }

  private item(label: string, description: string, icon: string, command: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = description;
    item.iconPath = new vscode.ThemeIcon(icon);
    item.command = { command, title: label };
    return item;
  }

  private async resolveSolution(root: VnextWorkspaceRoot): Promise<IndexSqlSolution | undefined> {
    let check = checkIndexSqlSolution(root.solutions);
    if (check.kind === 'pickSolution') {
      const picked = await vscode.window.showQuickPick(
        check.solutions.map((solution) => ({
          label: solution.config.domain,
          description: solution.fileName,
          ...(solution.isDefault ? { detail: 'Default solution — the one the Workflow CLI processes' } : {}),
          fileName: solution.fileName,
        })),
        {
          title: 'Generate Index SQL: select solution',
          placeHolder: 'This workspace holds several solution files.',
          ignoreFocusOut: true,
        },
      );
      if (!picked) return undefined;
      check = checkIndexSqlSolution(root.solutions, picked.fileName);
    }
    switch (check.kind) {
      case 'ready':
        return check.solution;
      case 'noDefault':
        void vscode.window.showErrorMessage(`vnext-forge-studio: ${NO_DEFAULT_SOLUTION_MESSAGE}`);
        return undefined;
      case 'nonDefault': {
        const useDefault = `Use ${check.fallback.config.domain}`;
        const action = await vscode.window.showWarningMessage(
          nonDefaultSolutionWarning(check.chosen, check.fallback),
          { modal: true },
          useDefault,
        );
        return action === useDefault ? check.fallback : undefined;
      }
      case 'pickSolution':
        // Not returned once a file name was chosen.
        return undefined;
    }
  }

  private async pickFlow(root: VnextWorkspaceRoot, solution: IndexSqlSolution): Promise<string | undefined> {
    const { components } = await scanVnextComponents(this.deps.fs, root.folderPath, solution.config.paths, {
      onlyCategory: 'workflows',
    });
    const flows = listIndexSqlFlows(components.workflows, solution.config.domain);
    if (flows.length === 0) {
      void vscode.window.showWarningMessage(
        `vnext-forge-studio: No local workflows of domain "${solution.config.domain}" were found.`,
      );
      return undefined;
    }
    const picked = await vscode.window.showQuickPick(
      flows.map((flow) => ({
        label: flow.key,
        description: vscode.workspace.asRelativePath(flow.path, false),
        key: flow.key,
      })),
      {
        title: 'Generate Index SQL: select workflow',
        placeHolder: 'Only workflows whose schema is a master schema produce SQL.',
        matchOnDescription: true,
        ignoreFocusOut: true,
      },
    );
    return picked?.key;
  }

  /** `false` = keep obsolete projections, `true` = retire (confirmed), `undefined` = cancelled. */
  private async pickRetireObsolete(): Promise<boolean | undefined> {
    const picked = await vscode.window.showQuickPick(
      [
        { label: 'Keep obsolete projections', description: 'default', retire: false },
        { label: 'Retire obsolete projections…', description: '--retire-obsolete', retire: true },
      ],
      { title: 'Generate Index SQL: obsolete projections', ignoreFocusOut: true },
    );
    if (!picked) return undefined;
    if (!picked.retire) return false;
    const action = await vscode.window.showWarningMessage(RETIRE_OBSOLETE_WARNING, { modal: true }, RETIRE_CONFIRM);
    return action === RETIRE_CONFIRM ? true : undefined;
  }

  private async run(argv: readonly string[], cwd: string): Promise<void> {
    if (this.running) {
      void vscode.window.showInformationMessage('vnext-forge-studio: Index SQL generation is already running.');
      return;
    }
    const result = await this.execute(argv, cwd);
    if (result.stdout) this.deps.output.append(result.stdout);
    if (result.stderr) this.deps.output.append(result.stderr);

    const outcome = parseWfIndexesGenerateOutput(result.stdout, result.stderr);
    if (result.exitCode !== 0 || outcome.kind !== 'generated') {
      const message =
        result.errorMessage ?? (outcome.kind === 'failed' ? outcome.message : 'The Workflow CLI reported an error.');
      const action = await vscode.window.showErrorMessage(
        `vnext-forge-studio: Index SQL generation failed: ${message}`,
        SHOW_OUTPUT,
      );
      if (action === SHOW_OUTPUT) this.deps.output.show(true);
      return;
    }

    const { batchDir, readmePath } = resolveIndexSqlBatch(cwd, outcome.batchPath);
    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(batchDir));
    const action = await vscode.window.showInformationMessage(
      `vnext-forge-studio: ${indexSqlSuccessMessage(outcome.count, batchDir, cwd)}`,
      OPEN_README,
    );
    if (action === OPEN_README) {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(readmePath));
      await vscode.window.showTextDocument(document, { preview: false });
    }
  }

  /** The CLI run itself; `running` covers only this span, not the follow-up notifications. */
  private async execute(argv: readonly string[], cwd: string): Promise<WfCapturedResult> {
    const runWf = this.deps.runWf ?? runWfCaptured;
    this.running = true;
    try {
      this.deps.output.appendLine(`[index-sql] ${cwd} $ wf ${argv.join(' ')}`);
      return await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating index SQL…' },
        () => runWf(argv, { cwd, timeoutMs: INDEX_SQL_TIMEOUT_MS }),
      );
    } finally {
      this.running = false;
    }
  }
}
```

- [ ] **Step 4: Register it in `extension.ts`**

Add after `import { PackageDeployProvider } from './tools/providers/package-deploy-provider.js';`:

```ts
import { DatabaseProvider } from './tools/providers/database-provider.js';
```

After the `packageDeployProvider` construction (the `new PackageDeployProvider(…);` statement), insert:

```ts
  // Offline attribute-index SQL (`wf indexes generate`, CLI ≥ 1.1.0). Runs
  // captured — no terminal — so the batch folder can be revealed afterwards.
  const databaseProvider = new DatabaseProvider({
    detector,
    fs: fsAdapter,
    wfCli,
    upgradeNotice: wfCliUpgradeNotice,
    output: outputChannel,
    installWfCli: () => packageDeployProvider.installWfCli(),
  });
  context.subscriptions.push(databaseProvider);
```

In the `createTreeView` block, directly after the `vnextForge.tools.packageDeploy` entry, insert:

```ts
    vscode.window.createTreeView('vnextForge.tools.database', {
      treeDataProvider: databaseProvider,
    }),
```

Directly after the `vnextForge.tools.installWfCli` registration (`…runDeployAction('installWfCli'),\n    )),`), insert:

```ts
    vscode.commands.registerCommand('vnextForge.tools.generateIndexSqlAll', safeAsync(() =>
      databaseProvider.generateIndexSql('all'),
    )),
    vscode.commands.registerCommand('vnextForge.tools.generateIndexSqlForFlow', safeAsync(() =>
      databaseProvider.generateIndexSql('flow'),
    )),
    // Re-probe `wf --version` (after an install/update finished in the terminal);
    // Package Deploy re-renders itself, Database listens to the probe.
    vscode.commands.registerCommand('vnextForge.tools.refreshWfCliStatus', safeAsync(() =>
      packageDeployProvider.refreshInstallStatus(),
    )),
```

- [ ] **Step 5: Contribute it in `apps/extension/package.json`**

1. `activationEvents`: after `"onView:vnextForge.tools.packageDeploy",` add `"onView:vnextForge.tools.database",`.
2. `contributes.views.vnextForgeTools`: after the `vnextForge.tools.packageDeploy` object add

```json
        {
          "id": "vnextForge.tools.database",
          "name": "Database",
          "when": "vnextForge.isVnextWorkspace"
        },
```

3. `contributes.commands`: after the `vnextForge.tools.installWfCli` object add

```json
      {
        "command": "vnextForge.tools.generateIndexSqlAll",
        "title": "Generate Index SQL for All Flows (wf indexes generate)",
        "category": "Forge",
        "icon": "$(database)"
      },
      {
        "command": "vnextForge.tools.generateIndexSqlForFlow",
        "title": "Generate Index SQL for Flow... (wf indexes generate --flow)",
        "category": "Forge",
        "icon": "$(filter)"
      },
      {
        "command": "vnextForge.tools.refreshWfCliStatus",
        "title": "Refresh Workflow CLI Status",
        "category": "Forge",
        "icon": "$(refresh)"
      },
```

4. `menus.commandPalette`: after the `{ "command": "vnextForge.tools.installWfCli", "when": "false" }` entry add

```json
        {
          "command": "vnextForge.tools.generateIndexSqlAll",
          "when": "vnextForge.isVnextWorkspace"
        },
        {
          "command": "vnextForge.tools.generateIndexSqlForFlow",
          "when": "vnextForge.isVnextWorkspace"
        },
        {
          "command": "vnextForge.tools.refreshWfCliStatus",
          "when": "vnextForge.isVnextWorkspace"
        },
```

5. `menus["view/title"]`: add as the first element of the array

```json
        {
          "command": "vnextForge.tools.refreshWfCliStatus",
          "when": "view == vnextForge.tools.database || view == vnextForge.tools.packageDeploy",
          "group": "navigation"
        },
```

Check the file is still valid JSON:

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/extension/package.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 6: Run the tests, the type check and the extension build**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/tools/index-sql/database-contributes.vitest.test.ts && pnpm --filter vnext-forge-studio exec tsc --noEmit -p tsconfig.json && pnpm --filter vnext-forge-studio run build:host`
Expected: PASS (3 tests); `tsc` exits 0; esbuild writes `dist/extension.js` without errors.

- [ ] **Step 7: Manual check in the Extension Development Host**

Open `vnext-forge` in VS Code, run the extension (F5, Extension Development Host) with `/Users/U0B006/Documents/repos/burgan-tech/vnext-example` as the workspace:
1. With a CLI below 1.1.0 (`wf --version`): the Database view shows only "Update Workflow CLI" with `requires 1.1.0+ (installed …)`; Package Deploy shows "Discovery cache may stay stale" under the three deploy actions.
2. With CLI 1.1.0 (for example `npm install -g` from `vnext-workflow-cli` `origin/master`, then the view-title refresh button): the Database view shows both Generate nodes; the Package Deploy info node is gone.
3. "Generate Index SQL for flow…" lists the local workflows; choose one, keep obsolete projections: a progress notification appears, the new `index-sql/<timestamp>-…` folder is revealed in the Explorer, and "Open README.txt" opens the README.
4. "Retire obsolete projections…" shows the modal; Cancel aborts without running.
5. A workspace without master-schema workflows: the error notification shows the CLI message and "Show Output" opens the `vnext-forge-studio-core` channel with the command line and CLI output.

If the Extension Development Host cannot be run, write "Manual extension check: not run" in the task report — do not claim it.

- [ ] **Step 8: Commit**

```bash
git add apps/extension/src/tools/providers/database-provider.ts apps/extension/src/tools/index-sql/database-contributes.vitest.test.ts apps/extension/src/extension.ts apps/extension/package.json
git commit -m "$(cat <<'EOF'
feat(extension): Forge Tools Database view for offline index SQL

Generate Index SQL (all flows / for flow) runs wf indexes generate captured,
reveals the batch folder and offers README.txt. --retire-obsolete sits behind
a modal confirm; only the default solution is processed.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Phase E gate

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: Turborepo finishes with every task successful (extension esbuild + webview vite included).

- [ ] **Step 2: Test suites and the extension type check**

Run: `pnpm --filter @vnext-forge-studio/services-core test && pnpm --filter vnext-forge-studio test && pnpm --filter vnext-forge-studio exec tsc --noEmit -p tsconfig.json`
Expected: both vitest suites PASS with no skipped new tests; `tsc` exits 0.

- [ ] **Step 3: D8 guard — no web/server `indexes` support crept in**

Run: `git diff "$(cat "$(git rev-parse --git-dir)/phase-e-base")"..HEAD --stat -- apps/server apps/web packages/services-core/src/services/cli/cli-schemas.ts packages/services-core/src/services/cli/cli.service.ts packages/services-core/src/registry`
Expected: no output.

- [ ] **Step 4: Per-file lint against the Phase E start commit**

Run:

```bash
BASE=$(cat "$(git rev-parse --git-dir)/phase-e-base")
count() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).reduce((a,r)=>a+r.errorCount,0))}catch{console.log("ERR")}})'; }
for f in $(git diff --name-only "$BASE"..HEAD -- '*.ts'); do
  now=$(pnpm exec eslint -f json "$f" 2>/dev/null | count)
  if git cat-file -e "$BASE:$f" 2>/dev/null; then
    before=$(git show "$BASE:$f" | pnpm exec eslint -f json --stdin --stdin-filename "$f" 2>/dev/null | count)
  else
    before=0
  fi
  status=ok; [ "$now" = "ERR" ] || [ "$before" = "ERR" ] || [ "$now" -gt "$before" ] && status=REGRESSION
  echo "$status $f before=$before now=$now"
done
```

Expected: every line starts with `ok` (no file gains ESLint errors; new files have 0). Fix any `REGRESSION` line before reporting. An `ERR` count means ESLint could not lint the file — report it rather than skipping it.

- [ ] **Step 5: Report**

Summarize per task: tests added, commands run with their results, the lint table, and the manual extension check result from Task 8 Step 7 (or "Manual extension check: not run"). Do not claim completion without the command output.

---

## Self-Review

**Spec coverage**
- E1 (argv spec, flow-key rule, no `--domain` / no `wf domain use`, single `WF_INDEXES_MIN_VERSION = '1.1.0'`, `wfSupportsIndexes`) → Task 1 (the "smuggled domain" test pins the no-`--domain` rule; the builder is outside `WfCommandSpec`, so `buildWfShellCommand`'s legacy prefix cannot reach it).
- E2 (probe `supportsIndexes`, `supportsPublishCompleted` ≥ 1.1.0) → Task 3.
- E3 (`WfCliUpgradeNotice` generalized to `(featureName, minVersion)`) → Task 4 (`WfCliFeature`, once per feature; `show` for explicit actions).
- E4 (Database group, both Generate nodes, flow quick-pick of local workflows, `--retire-obsolete` modal, "Update Workflow CLI" node, multi-domain warning, captured run, parse `Generated N SQL file(s): <path>`, reveal batch folder, offer README.txt, contributes + registration) → Tasks 2, 6, 7 (pure) and Task 8 (glue, `package.json`, `extension.ts`).
- E5 (Package Deploy info node below 1.1.0 with the spec sentence) → Task 5.
- D8 (no web/server `cli/execute` support) → Global Constraints + Task 9 Step 3.
- Gates (build, services-core + extension suites, per-file lint vs phase start, manual check) → Task 9, Task 8 Step 7.

**Placeholder scan** — every code step carries full code; no "similar to Task N" references; the only conditional instruction (Task 6 Step 4 cast) names the exact expression to use.

**Type consistency** — `WfCliInfo` fields (`supportsIndexes`, `supportsPublishCompleted`) are defined in Task 3 and used by Tasks 5, 7, 8; `WF_CLI_NOT_INSTALLED` (Task 3) is used by the Task 5 and Task 7 tests; `WfCliFeature` / `WF_CLI_FEATURES.indexes` / `wfCliUpgradeMessage` (Task 4) are used by Task 8; `WfCliUpgradeNotice.show` (Task 4) is used by Task 8; `onDidInvalidate` (Task 3) is used by Task 8; `DeployCommandId` / `DeployNodeId` (Task 5) replace the provider's local aliases; `runWfCaptured` / `WfCapturedResult` (Task 6), `DatabaseNodeId` / `IndexSqlSolution` / `checkIndexSqlSolution` / `listIndexSqlFlows` / `resolveIndexSqlBatch` / `nonDefaultSolutionWarning` / `indexSqlSuccessMessage` / `NO_DEFAULT_SOLUTION_MESSAGE` / `RETIRE_OBSOLETE_WARNING` (Task 7) match the Task 8 imports; `buildWfIndexesGenerateArgv` / `parseWfIndexesGenerateOutput` / `WF_INDEXES_MIN_VERSION` / `WF_PUBLISH_COMPLETED_MIN_VERSION` (Tasks 1–2) match the extension imports.
