# State Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `notifications` array to the State property panel so users can configure notification entries (type, required mapping, optional rule) directly in the workflow designer.

**Architecture:** Extend `State` in `vnext-types` with a new `StateNotification` interface and `notifications?: StateNotification[]` field. Add a controlled `StateNotificationsEditor` component in the state-tab editors folder, following the same pattern as `StateInteractionEditor` and `StateAliasEditor`. Wire the editor into `GeneralTab` with the same `updateWorkflow` draft-mutation pattern used by all other fields there.

**Tech Stack:** TypeScript, React 19, Immer drafts (`updateWorkflow`), `CsxEditorField` (existing), `MappingScriptsSection` (existing), `PropertyPanelShared` primitives (`Section`, `SelectField`, `IconPlus`, `IconTrash`), `@vnext-forge-studio/vnext-types`, `@vnext-forge-studio/designer-ui`

---

## File Map

| Action | Path |
|--------|------|
| Modify | `packages/vnext-types/src/types/state.ts` |
| Create | `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/StateNotificationsEditor.tsx` |
| Modify | `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/GeneralTab.tsx` |

---

### Task 1: Add `StateNotification` type and `notifications` field to `State`

**Files:**
- Modify: `packages/vnext-types/src/types/state.ts`

- [ ] **Step 1: Add the `StateNotification` interface and extend `State`**

Open `packages/vnext-types/src/types/state.ts`. After the `StateInteraction` interface (line 105), add:

```typescript
/**
 * A single notification rule attached to a state. The engine fires
 * the notification when the state is entered. `type` identifies the
 * notification channel type (0 = State). `mapping` is the required
 * payload mapping script; `rule` is an optional condition — if
 * omitted the notification always fires.
 */
export interface StateNotification {
  type: number;
  mapping: MappingCode;
  rule?: MappingCode;
}
```

Then add `notifications?: StateNotification[];` to the `State` interface after the `interaction` line:

```typescript
export interface State {
  key: string;
  alias?: StateAlias[];
  stateType: StateType;
  subType?: StateSubType;
  versionStrategy?: string;
  queryRoles?: RoleGrant[];
  labels?: Label[];
  onEntries?: TaskExecution[];
  onExits?: TaskExecution[];
  transitions?: Transition[];
  errorBoundary?: ErrorBoundary;
  view?: ViewBinding;
  views?: ViewBinding[];
  subFlow?: SubFlowConfig;
  interaction?: StateInteraction | null;
  notifications?: StateNotification[];
}
```

- [ ] **Step 2: Build vnext-types to confirm no compile errors**

```bash
cd /Users/U0B006/Documents/repos/burgan-tech/vnext-forge
pnpm --filter @vnext-forge-studio/vnext-types build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/vnext-types/src/types/state.ts
git commit -m "feat(vnext-types): add StateNotification interface and notifications field on State"
```

---

### Task 2: Create `StateNotificationsEditor` component

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/StateNotificationsEditor.tsx`

- [ ] **Step 1: Create the component file**

Create `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/StateNotificationsEditor.tsx` with the following content:

```tsx
import type { StateNotification, MappingCode } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { Section, SelectField, IconPlus, IconTrash } from '../PropertyPanelShared';

interface StateNotificationsEditorProps {
  notifications: StateNotification[];
  stateKey: string;
  onChange: (next: StateNotification[]) => void;
}

const NOTIFICATION_TYPE_OPTIONS = [
  { value: '0', label: 'State' },
];

function emptyNotification(): StateNotification {
  return { type: 0, mapping: { location: '', code: '' } };
}

function toScriptCode(mc: MappingCode | undefined): ScriptCode | null {
  if (!mc) return null;
  return mc as ScriptCode;
}

function fromScriptCode(sc: ScriptCode): MappingCode {
  return sc as MappingCode;
}

export function StateNotificationsEditor({
  notifications,
  stateKey,
  onChange,
}: StateNotificationsEditorProps) {
  const add = () => onChange([...notifications, emptyNotification()]);

  const remove = (index: number) => {
    const next = notifications.filter((_, i) => i !== index);
    onChange(next);
  };

  const patchEntry = (index: number, patch: Partial<StateNotification>) => {
    onChange(notifications.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  };

  return (
    <Section title="Notifications" count={notifications.length} defaultOpen={notifications.length > 0}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Configure notifications fired when this state is entered.
      </p>

      <div className="space-y-3">
        {notifications.map((n, index) => (
          <div
            key={index}
            className="border border-border-subtle rounded-xl bg-surface p-2.5 space-y-2.5"
          >
            {/* Header row: type + remove */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                  Type
                </label>
                <SelectField
                  value={String(n.type)}
                  onChange={(v) => patchEntry(index, { type: Number(v) })}
                  options={NOTIFICATION_TYPE_OPTIONS}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 mt-4 transition-all"
                aria-label="Remove notification"
                title="Remove notification"
              >
                <IconTrash />
              </button>
            </div>

            {/* Mapping (required) */}
            <div>
              <label className="text-[9px] font-medium text-muted-foreground mb-1 block">
                Mapping
              </label>
              <CsxEditorField
                value={toScriptCode(n.mapping)}
                onChange={(sc) => patchEntry(index, { mapping: fromScriptCode(sc) })}
                templateType="mapping"
                contextName={`${stateKey}-notification-${index}-mapping`}
                label="Mapping"
                stateKey={stateKey}
                listField="notifications"
                index={index}
                scriptField="mapping"
                allowRefEncoding
              />
              {n.mapping && (
                <MappingScriptsSection
                  value={(n.mapping as any).scripts}
                  onChange={(scripts) =>
                    patchEntry(index, { mapping: { ...n.mapping, scripts } as MappingCode })
                  }
                />
              )}
            </div>

            {/* Rule (optional) */}
            <div>
              <label className="text-[9px] font-medium text-muted-foreground mb-1 block">
                Rule
                <span className="ml-1 text-subtle font-normal">(optional)</span>
              </label>
              <CsxEditorField
                value={toScriptCode(n.rule)}
                onChange={(sc) => patchEntry(index, { rule: fromScriptCode(sc) })}
                onRemove={() => patchEntry(index, { rule: undefined })}
                templateType="condition"
                contextName={`${stateKey}-notification-${index}-rule`}
                label="Rule"
                stateKey={stateKey}
                listField="notifications"
                index={index}
                scriptField="rule"
                allowRefEncoding
              />
              {n.rule && (
                <MappingScriptsSection
                  value={(n.rule as any).scripts}
                  onChange={(scripts) =>
                    patchEntry(index, { rule: { ...n.rule, scripts } as MappingCode })
                  }
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors mt-2"
      >
        <IconPlus />
        Add notification
      </button>
    </Section>
  );
}
```

- [ ] **Step 2: Build designer-ui to confirm no compile errors**

```bash
cd /Users/U0B006/Documents/repos/burgan-tech/vnext-forge
pnpm --filter @vnext-forge-studio/designer-ui build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/StateNotificationsEditor.tsx
git commit -m "feat(designer-ui): add StateNotificationsEditor for state notification config"
```

---

### Task 3: Wire `StateNotificationsEditor` into `GeneralTab`

**Files:**
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/GeneralTab.tsx`

- [ ] **Step 1: Add the import**

At the top of `GeneralTab.tsx`, after the existing state-tab imports (e.g. after the `StateInteractionEditor` import on line 8), add:

```typescript
import { StateNotificationsEditor } from './state/StateNotificationsEditor';
```

Also add `StateNotification` to the existing type import from `@vnext-forge-studio/vnext-types` on line 2:

```typescript
import type { RoleGrant, StateAlias, StateInteraction, StateNotification, ViewBinding } from '@vnext-forge-studio/vnext-types';
```

- [ ] **Step 2: Add `updateNotifications` callback in `GeneralTab`**

After the `updateInteraction` callback (around line 103), add:

```typescript
const updateNotifications = useCallback((next: StateNotification[]) => {
  updateWorkflow((draft: any) => {
    const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
    if (!s) return;
    if (next.length === 0) delete s.notifications;
    else s.notifications = next;
  });
}, [updateWorkflow, stateKey]);
```

- [ ] **Step 3: Render `StateNotificationsEditor` in the JSX**

In the JSX return, after the `<StateInteractionEditor ... />` block (around line 308–311) and before the `<ViewBindingsSection ... />` block, add:

```tsx
{/* Notifications */}
<StateNotificationsEditor
  notifications={state.notifications ?? []}
  stateKey={stateKey}
  onChange={updateNotifications}
/>
```

- [ ] **Step 4: Build the full workspace to confirm no compile errors**

```bash
cd /Users/U0B006/Documents/repos/burgan-tech/vnext-forge
pnpm build
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/GeneralTab.tsx
git commit -m "feat(designer-ui): wire StateNotificationsEditor into State GeneralTab"
```

---

## Self-Review

**Spec coverage:**
- ✅ `notifications` array on State with `type`, `mapping`, `rule`
- ✅ `rule` is optional (CsxEditorField `onRemove` prop allows removal; not seeded on new entries)
- ✅ `type` and `mapping` are required (seeded in `emptyNotification()`, no remove option for mapping)
- ✅ `type` is a dropdown (SelectField with `NOTIFICATION_TYPE_OPTIONS`)
- ✅ Currently only `"0"` (State) as type option
- ✅ `mapping` and `rule` use the same base model (`MappingCode` / `ScriptCode`) as other places
- ✅ Empty array strips the field from JSON (consistent with `alias`, `interaction` conventions)
- ✅ MappingScriptsSection wired for both mapping and rule (consistent with TransitionConditionSection pattern)

**Placeholder scan:** No TBDs, all code is complete.

**Type consistency:** `StateNotification`, `MappingCode`, `ScriptCode` names are consistent across all three tasks. `patchEntry` / `fromScriptCode` / `toScriptCode` are only used inside `StateNotificationsEditor`.
