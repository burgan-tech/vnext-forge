---
name: NAT CSX Editor Support
overview: Add NAT (Native) encoding support to the CSX editor pipeline so that when `encoding === 'NAT'`, plain C# code is stored directly in the workflow JSON without base64 encoding, with full Monaco + LSP IntelliSense support.
todos:
  - id: codec-module
    content: Create ScriptCodec.ts — pure encoding-aware decode/encode helpers
    status: pending
  - id: tighten-type
    content: Tighten ScriptCode.encoding type from string to 'B64' | 'NAT'; remove duplicate in CsxEditorField
    status: pending
  - id: panel-update
    content: Update ScriptEditorPanel for encoding-aware read/write + conditional location + status bar indicator
    status: pending
  - id: field-update
    content: "Update CsxEditorField: NAT creation, encoding badge, codec-based preview"
    status: pending
  - id: save-pipeline
    content: "Update FlowEditorSchema + FlowEditorApi: NAT-aware sidecar extraction, optional location"
    status: pending
  - id: task-editor
    content: Align ScriptTaskForm and persistScriptTaskScriptFile with unified codec
    status: pending
  - id: closing-review
    content: Dispatch code-reviewer and ui-ux-designer for spec/a11y conformance
    status: pending
isProject: false
---

# NAT (Native) C# Encoding Support for CSX Editor

## Goal

The vNext mapping spec (v0.0.23+) defines two encoding modes for C# mapping scripts: `B64` (base64-encoded) and `NAT` (native plain text). Today the designer stack treats every script as B64 end-to-end. This plan adds **NAT encoding support** so that plain C# code can be stored directly in workflow JSON, edited with full Monaco + LSP IntelliSense, and persisted without base64 encode/decode overhead.

Per `ai-docs/mapping.md`:
- **B64**: `code` is base64-encoded, `location` is required (sidecar `.csx` file)
- **NAT**: `code` is plain C# text, `location` is **not required** (inline in JSON)

---

## Current State (Phase A — Explorer findings)

### Files in scope

| File | Role | NAT impact |
|------|------|------------|
| [`packages/vnext-types/src/types/mapping.ts`](packages/vnext-types/src/types/mapping.ts) | `MappingCode` type — already has `encoding?: 'B64' \| 'NAT'` | None needed |
| [`packages/designer-ui/src/modules/code-editor/CodeEditorTypes.ts`](packages/designer-ui/src/modules/code-editor/CodeEditorTypes.ts) | `ScriptCode` — has `encoding?: string` (loose) | Tighten type |
| [`packages/designer-ui/src/modules/code-editor/layout/ScriptEditorPanel.tsx`](packages/designer-ui/src/modules/code-editor/layout/ScriptEditorPanel.tsx) | Main editor — always decodes B64, always encodes B64 on save | Encoding-aware read/write |
| [`packages/designer-ui/src/modules/save-component/components/CsxEditorField.tsx`](packages/designer-ui/src/modules/save-component/components/CsxEditorField.tsx) | Compact card — always creates B64 scripts | NAT creation mode |
| [`packages/designer-ui/src/modules/code-editor/ScriptPanelStore.ts`](packages/designer-ui/src/modules/code-editor/ScriptPanelStore.ts) | Active script Zustand store | No change needed |
| [`packages/designer-ui/src/modules/code-editor/ScriptWorkflowSync.ts`](packages/designer-ui/src/modules/code-editor/ScriptWorkflowSync.ts) | Patches workflow draft | No change needed (encoding-agnostic) |
| [`packages/designer-ui/src/modules/code-editor/editor/Base64Handler.ts`](packages/designer-ui/src/modules/code-editor/editor/Base64Handler.ts) | B64 helpers | Add unified codec |
| [`packages/designer-ui/src/modules/flow-editor/FlowEditorApi.ts`](packages/designer-ui/src/modules/flow-editor/FlowEditorApi.ts) | Save workflow — `extractScripts` + write sidecars | Skip NAT scripts in sidecar loop |
| [`packages/designer-ui/src/modules/flow-editor/FlowEditorSchema.ts`](packages/designer-ui/src/modules/flow-editor/FlowEditorSchema.ts) | Zod schema requiring `location` | Make `location` optional for NAT |
| [`packages/designer-ui/src/modules/task-editor/forms/ScriptTaskForm.tsx`](packages/designer-ui/src/modules/task-editor/forms/ScriptTaskForm.tsx) | Task inline script — partial NAT support | Align with unified codec |
| [`packages/designer-ui/src/modules/task-editor/persistScriptTaskScriptFile.ts`](packages/designer-ui/src/modules/task-editor/persistScriptTaskScriptFile.ts) | Script task persist — already has encoding check | Align with unified codec |
| [`packages/lsp-core/src/lsp-workspace.ts`](packages/lsp-core/src/lsp-workspace.ts) | `wrapCsxContent` / `getWrapOffset` | No change needed (heuristic already handles NAT-shaped code) |
| [`packages/lsp-core/src/lsp-bridge.ts`](packages/lsp-core/src/lsp-bridge.ts) | URI rewrite + diagnostic shift | No change needed |

### Dominant patterns

- B64 is hardcoded at every read/write boundary in the editor pipeline
- `ScriptWorkflowSync` and `ScriptPanelStore` are already encoding-agnostic (they pass through `ScriptCode` objects)
- LSP wrapping (`wrapCsxContent`) already skips implicit usings when code starts with `using` or `#` — NAT code with full usings gets `wrapOffset === 0` automatically
- `persistScriptTaskScriptFile` has partial encoding-aware decode (the only place that checks `encoding === 'B64'`)

---

## Decisions (Phase B — Architect Debate)

### Option A — Unified Pipeline (CHOSEN)

Extend `ScriptEditorPanel` and `CsxEditorField` with encoding-aware branching via a **single codec module**. Same store, same panel, same component hierarchy. NAT is a mode of the existing editor, not a separate component.

### Option B — Parallel NAT Surface (REJECTED)

Create a separate `NatScriptEditorPanel` + `NatEditorField`. Rejected because:
- Duplicates Monaco setup, LSP lifecycle, toolbar, dirty checks
- Two surfaces to keep WCAG-consistent
- Fixes/features applied twice; easy drift
- Many call sites reference `CsxEditorField` — all would need branching to pick the right component

### Decision rationale

The domain model is already "one `ScriptCode` blob per mapping"; `ScriptWorkflowSync` and the store do not care about encoding. The real forks are (1) editor I/O, (2) card preview/create defaults, (3) sidecar save/extract, and (4) LSP wrapping — all smaller, testable seams than a second panel. Centralizing in one codec module keeps the blast radius small.

### Open questions resolved

- **Sidecar policy**: NAT scripts are inline-only (no `.csx` sidecar). This matches the spec: `location` is not required for NAT.
- **Default encoding**: New scripts default to B64 (preserving current behavior). NAT is offered as an explicit choice.
- **Runtime compatibility**: The runtime supports NAT since v0.0.23 per `ai-docs/mapping.md`.
- **LSP**: No `lsp-core` changes needed — `wrapCsxContent` heuristic already handles NAT-shaped code correctly.

---

## UI/UX Direction (Phase C)

Phase C applies because `CsxEditorField` gains a new creation mode and `ScriptEditorPanel` gains encoding-aware chrome.

### CsxEditorField changes

- **Empty state (no script)**: Add a secondary action "Create Native Script" alongside the existing "Create Script" button. The primary "Create Script" remains B64 (default). The secondary action uses a smaller text button or dropdown.
- **Has-script state**: Show an encoding badge (`B64` / `NAT`) on the card. For NAT, hide the location row (no sidecar path). Preview decodes using the unified codec.
- **States**: default / hover / focus / active remain the same; the encoding badge is informational only.
- **Keyboard**: Both create actions reachable via Tab; Enter/Space triggers.

### ScriptEditorPanel changes

- **Header**: When NAT, hide the location input and location validation. Show an `encoding` indicator (small label or badge: "Native" / "Base64").
- **Monaco editor**: No visible change — always shows plain C#.
- **Status bar**: Show encoding type alongside "UTF-8" (e.g. "NAT | UTF-8" or "B64 | UTF-8").
- **No new states**: Loading, error, empty states remain identical.
- **Keyboard/ARIA**: Location input becomes conditionally rendered (not just hidden), so focus order naturally skips it for NAT.

### Motion

No new animations required.

### WCAG/a11y

- Encoding badge uses sufficient contrast. Informational only (no action).
- Location input conditionally rendered to keep focus order clean.

---

## Implementation Steps (Phase D)

### Step 1 — Unified script codec module (sequential)

Create a pure-function codec module that centralizes encoding-aware read/write:

**File**: [`packages/designer-ui/src/modules/code-editor/editor/ScriptCodec.ts`](packages/designer-ui/src/modules/code-editor/editor/ScriptCodec.ts) (new)

```ts
import { encodeToBase64, decodeFromBase64, isBase64 } from './Base64Handler';

export type ScriptEncoding = 'B64' | 'NAT';

export function decodeScriptCode(code: string | undefined, encoding?: string): string {
  if (!code) return '';
  if (encoding === 'NAT') return code;
  return decodeFromBase64(code);
}

export function encodeScriptCode(plainText: string, encoding: ScriptEncoding): string {
  if (encoding === 'NAT') return plainText;
  return encodeToBase64(plainText);
}

export function getScriptEncoding(encoding?: string): ScriptEncoding {
  return encoding === 'NAT' ? 'NAT' : 'B64';
}
```

**File allowlist**: `packages/designer-ui/src/modules/code-editor/editor/ScriptCodec.ts`

### Step 2 — Tighten `ScriptCode` type (sequential)

In [`CodeEditorTypes.ts`](packages/designer-ui/src/modules/code-editor/CodeEditorTypes.ts), tighten `encoding` from `string` to `'B64' | 'NAT'`:

```ts
export interface ScriptCode {
  location: string;
  code: string;
  encoding?: 'B64' | 'NAT';
}
```

Also align the duplicate `ScriptCode` in [`CsxEditorField.tsx`](packages/designer-ui/src/modules/save-component/components/CsxEditorField.tsx) — import from `CodeEditorTypes` instead of re-declaring.

**File allowlist**: `CodeEditorTypes.ts`, `CsxEditorField.tsx`

### Step 3 — Update `ScriptEditorPanel` for encoding-aware read/write (sequential)

In [`ScriptEditorPanel.tsx`](packages/designer-ui/src/modules/code-editor/layout/ScriptEditorPanel.tsx):

- Replace `decodeFromBase64(activeScript.value.code)` with `decodeScriptCode(activeScript.value.code, activeScript.value.encoding)`
- Replace `encodeToBase64(newCode)` + `encoding: 'B64'` with `encodeScriptCode(newCode, currentEncoding)` + `encoding: currentEncoding` where `currentEncoding = getScriptEncoding(activeScript.value.encoding)`
- Conditionally hide location input when `encoding === 'NAT'`
- Add encoding indicator in the status bar

**File allowlist**: `ScriptEditorPanel.tsx`

### Step 4 — Update `CsxEditorField` for NAT creation and preview (sequential)

In [`CsxEditorField.tsx`](packages/designer-ui/src/modules/save-component/components/CsxEditorField.tsx):

- Add `handleCreateNat` alongside existing `handleCreate`: calls `generateTemplate(...)`, stores `code` as plain text with `encoding: 'NAT'` and empty `location`
- Replace `decodeFromBase64(value.code)` in preview with `decodeScriptCode(value.code, value.encoding)`
- Add encoding badge on the script card
- Add "Create Native Script" button/option in empty state

**File allowlist**: `CsxEditorField.tsx`

### Step 5 — Update save pipeline for encoding-aware sidecar extraction (sequential)

In [`FlowEditorSchema.ts`](packages/designer-ui/src/modules/flow-editor/FlowEditorSchema.ts):

- Add `encoding` to the script schema: `encoding: z.enum(['B64', 'NAT']).optional()`
- Make `location` conditional: required for B64, optional for NAT

In [`FlowEditorApi.ts`](packages/designer-ui/src/modules/flow-editor/FlowEditorApi.ts):

- In the sidecar write loop, skip scripts where `encoding === 'NAT'` (no sidecar)
- For B64 scripts, use `decodeScriptCode` instead of raw `decodeFromBase64`
- Fix `extractScripts` dedup to handle entries without `location` (use `stateKey + field + index` composite key or skip NAT entries from dedup entirely)

**File allowlist**: `FlowEditorSchema.ts`, `FlowEditorApi.ts`

### Step 6 — Align task editor paths (sequential)

In [`ScriptTaskForm.tsx`](packages/designer-ui/src/modules/task-editor/forms/ScriptTaskForm.tsx):

- Replace `configToScriptCode` B64-only logic with codec: use `decodeScriptCode` / `encodeScriptCode`
- Preserve encoding from config when it's `NAT`

In [`persistScriptTaskScriptFile.ts`](packages/designer-ui/src/modules/task-editor/persistScriptTaskScriptFile.ts):

- Replace local `decodeConfigScript` with imported `decodeScriptCode`

**File allowlist**: `ScriptTaskForm.tsx`, `persistScriptTaskScriptFile.ts`

---

## Closing Review (parallel)

After implementation, dispatch reviewers in parallel:

**Closing review (parallel):** `code-reviewer` || `ui-ux-designer` (spec/a11y conformance)

- `code-reviewer`: correctness of codec usage, no B64 assumptions left, save pipeline integrity
- `ui-ux-designer`: encoding badge contrast, focus order when location is hidden, card layout consistency

No `security-reviewer` needed (no auth/secrets/input handling changes). No `database-reviewer` (no SQL). No `architect-reviewer` (single-module change, no new boundaries). No `refactor-cleaner` (no refactor in scope — this is a new feature).
