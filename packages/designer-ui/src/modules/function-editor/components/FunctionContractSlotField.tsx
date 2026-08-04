import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, FileJson, Plus, Trash2 } from 'lucide-react';

import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type { FunctionComponentRef, ScriptsConfig } from '@vnext-forge-studio/vnext-types';

import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';
import { Badge } from '../../../ui/Badge';
import { Checkbox } from '../../../ui/Checkbox';
import { useProjectStore } from '../../../store/useProjectStore';
import {
  ChooseExistingVnextComponentDialog,
  ChooseFromExistingVnextComponentButton,
} from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import {
  CreateNewComponentButton,
  CreateNewComponentDialog,
} from '../../canvas-interaction/components/panels/tabs/CreateNewComponentDialog';
import { CsxEditorField, type ScriptCode } from '../../save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../save-component/components/MappingScriptsSection';
import { OpenVnextComponentInModalButton } from '../../save-component/components/OpenVnextComponentInModalButton.js';
import {
  SLOT_KINDS,
  entriesFromSingle,
  findShadowingFallbackIndex,
  isComponentFileRef,
  isEmptyComponentRef,
  isFallbackEntry,
  readSlot,
  refFromDiscoveredComponent,
  singleFromEntries,
  writeSlotEntries,
  writeSlotSingle,
  type SlotKind,
  type SlotMode,
  type SlotRuleEntry,
} from '../functionContractSlots';

interface FunctionContractSlotFieldProps {
  kind: SlotKind;
  /** Visible label, e.g. "Input View". */
  label: string;
  hint: string;
  /** Raw slot value read off `attributes`. */
  value: unknown;
  /** Persist the canonical next value; `undefined` drops the slot key. */
  onChange: (next: unknown) => void;
  /** Owning function's key — used for script-panel identity and template naming. */
  functionKey: string;
  /**
   * Script-panel `listField` sentinel for this slot, e.g.
   * `functionInputView`. `FunctionEditorView` routes it back into
   * `attributes.<slot>[index].rule`; without a matching branch there,
   * rule edits would never reach the document.
   */
  scriptListField: string;
  onBeforeOpenModal?: () => void;
}

/**
 * Editor for one function contract slot — `inputView`, `outputView`,
 * `inputSchema` or `outputSchema`.
 *
 * A slot is either a single unconditional component reference or an
 * ordered list of rule entries where the first match wins. The two slot
 * kinds differ only in flow (`sys-views` / `sys-schemas`), the entry's
 * reference key, and whether `loadData` applies — so one component
 * parameterized by `kind` covers all four fields.
 *
 * This deliberately does *not* reuse `ViewBindingsSection` (which edits
 * transition views): that component also edits `extensions`, which the
 * function contract rejects on a view entry.
 */
export function FunctionContractSlotField({
  kind,
  label,
  hint,
  value,
  onChange,
  functionKey,
  scriptListField,
  onBeforeOpenModal,
}: FunctionContractSlotFieldProps) {
  const config = SLOT_KINDS[kind];
  const state = readSlot(kind, value);

  const [pickerTarget, setPickerTarget] = useState<number | 'single' | null>(null);
  const [creatorTarget, setCreatorTarget] = useState<number | 'single' | null>(null);

  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  const hasContent = state.ref != null || state.entries.length > 0;
  // Mode follows the stored value whenever there is one, so undo/redo and
  // document reloads can never leave the toggle out of sync. The local
  // preference only decides which mode an *empty* slot starts in.
  const [preferredMode, setPreferredMode] = useState<SlotMode>(state.mode);
  const mode = hasContent ? state.mode : preferredMode;

  function switchMode(next: SlotMode) {
    if (next === mode) return;
    setPreferredMode(next);
    if (next === 'rule-based') {
      onChange(writeSlotEntries(kind, entriesFromSingle(state.ref)));
    } else {
      onChange(writeSlotSingle(singleFromEntries(state.entries)));
    }
  }

  function commitEntries(entries: SlotRuleEntry[]) {
    onChange(writeSlotEntries(kind, entries));
  }

  function updateEntry(index: number, patch: (entry: SlotRuleEntry) => SlotRuleEntry) {
    const next = [...state.entries];
    if (!next[index]) return;
    next[index] = patch(next[index]);
    commitEntries(next);
  }

  function handleSelectComponent(component: DiscoveredVnextComponent) {
    const target = pickerTarget ?? creatorTarget;
    setPickerTarget(null);
    setCreatorTarget(null);
    if (target == null) return;
    const ref = refFromDiscoveredComponent(kind, component, projectDomain);
    if (target === 'single') {
      onChange(writeSlotSingle(ref));
    } else {
      updateEntry(target, (entry) => ({ ...entry, ref }));
    }
  }

  const shadowingIndex = findShadowingFallbackIndex(state.entries);

  /* ── Unrecognized value: never rewrite it blindly ── */
  if (state.unrecognized) {
    return (
      <div className="space-y-2">
        <SlotHeader label={label} hint={hint} />
        <Alert variant="warning" className="py-2">
          <AlertTitle>Unrecognized {config.noun} contract</AlertTitle>
          <AlertDescription>
            <code className="font-mono text-[10px]">{previewJson(value)}</code> matches none of the
            shapes this field understands. Edit the JSON directly, or clear it to start over.
          </AlertDescription>
        </Alert>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-destructive-text hover:text-destructive-text/80 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors">
          <Trash2 className="size-3.5 shrink-0" aria-hidden />
          Clear {label}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SlotHeader label={label} hint={hint} />

      <div
        className="bg-muted flex gap-0.5 rounded-lg p-0.5"
        role="radiogroup"
        aria-label={`${label} mode`}>
        <ModeButton
          active={mode === 'single'}
          onClick={() => switchMode('single')}
          label={`Single ${config.noun}`}
        />
        <ModeButton
          active={mode === 'rule-based'}
          onClick={() => switchMode('rule-based')}
          label={`Rule-based ${config.wrapperKey}`}
        />
      </div>

      {mode === 'single' ? (
        isEmptyComponentRef(state.ref) ? (
          <SlotPickActions
            kind={kind}
            canPickExisting={canPickExisting}
            onPick={() => setPickerTarget('single')}
            onCreate={() => setCreatorTarget('single')}
          />
        ) : (
          <ComponentRefRow
            ref_={state.ref!}
            onRemove={() => onChange(undefined)}
            onReplace={() => setPickerTarget('single')}
            canPickExisting={canPickExisting}
            onBeforeOpenModal={onBeforeOpenModal}
            noun={config.noun}
          />
        )
      ) : (
        <div className="space-y-2">
          {state.entries.length === 0 ? (
            <Alert variant="muted" className="py-2">
              <AlertTitle>No rules yet</AlertTitle>
              <AlertDescription>
                Entries are evaluated in order and the first match wins. End with a rule-less entry
                as the fallback.
              </AlertDescription>
            </Alert>
          ) : null}

          {state.entries.map((entry, index) => (
            <div
              key={index}
              className="bg-surface border-border overflow-hidden rounded-lg border shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="border-border flex items-center gap-2 border-b px-2.5 py-1.5">
                <span className="text-muted-foreground font-mono text-[10px] font-semibold">
                  #{index + 1}
                </span>
                {isFallbackEntry(entry) ? (
                  <Badge
                    variant={index === state.entries.length - 1 ? 'muted' : 'warning'}
                    className="px-1.5 py-0 text-[9px]">
                    Fallback — always matches
                  </Badge>
                ) : null}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <IconAction
                    label={`Move entry ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => commitEntries(moveItem(state.entries, index, index - 1))}>
                    <ArrowUp size={12} />
                  </IconAction>
                  <IconAction
                    label={`Move entry ${index + 1} down`}
                    disabled={index === state.entries.length - 1}
                    onClick={() => commitEntries(moveItem(state.entries, index, index + 1))}>
                    <ArrowDown size={12} />
                  </IconAction>
                  <IconAction
                    label={`Remove entry ${index + 1}`}
                    destructive
                    onClick={() => commitEntries(state.entries.filter((_, i) => i !== index))}>
                    <Trash2 size={12} />
                  </IconAction>
                </div>
              </div>

              <div className="space-y-2 px-2.5 py-2">
                {isEmptyComponentRef(entry.ref) ? (
                  <SlotPickActions
                    kind={kind}
                    canPickExisting={canPickExisting}
                    onPick={() => setPickerTarget(index)}
                    onCreate={() => setCreatorTarget(index)}
                  />
                ) : (
                  <ComponentRefRow
                    ref_={entry.ref!}
                    onRemove={() => updateEntry(index, ({ rule, loadData }) => ({ rule, loadData }))}
                    onReplace={() => setPickerTarget(index)}
                    canPickExisting={canPickExisting}
                    onBeforeOpenModal={onBeforeOpenModal}
                    noun={config.noun}
                  />
                )}

                <CsxEditorField
                  value={entry.rule}
                  onChange={(rule) => updateEntry(index, (e) => ({ ...e, rule }))}
                  onRemove={() =>
                    updateEntry(index, ({ ref, loadData }) => ({ ref, loadData }))
                  }
                  templateType="condition"
                  contextName={`${functionKey}-${scriptListField}-${index + 1}`}
                  label="Rule"
                  stateKey={functionKey}
                  listField={scriptListField}
                  index={index}
                  scriptField="rule"
                />
                {entry.rule ? (
                  <MappingScriptsSection
                    value={(entry.rule as { scripts?: ScriptsConfig }).scripts}
                    onChange={(scripts) =>
                      updateEntry(index, (e) => {
                        if (!e.rule) return e;
                        const rule = { ...e.rule } as ScriptCode & { scripts?: ScriptsConfig };
                        if (scripts === undefined) delete rule.scripts;
                        else rule.scripts = scripts;
                        return { ...e, rule };
                      })
                    }
                  />
                ) : null}

                {config.hasLoadData ? (
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={entry.loadData === true}
                      onCheckedChange={(next) =>
                        updateEntry(index, (e) => ({
                          ...e,
                          loadData: next === true ? true : undefined,
                        }))
                      }
                    />
                    Load instance data alongside this view
                  </label>
                ) : null}
              </div>
            </div>
          ))}

          {shadowingIndex >= 0 ? (
            <Alert variant="warning" className="py-2">
              <AlertTitle>Entry #{shadowingIndex + 1} shadows the entries below it</AlertTitle>
              <AlertDescription>
                It has no rule, so it always matches and nothing after it can ever be selected. Move
                it last.
              </AlertDescription>
            </Alert>
          ) : null}

          <button
            type="button"
            onClick={() => commitEntries([...state.entries, {}])}
            className="text-secondary-icon hover:text-secondary-foreground inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors">
            <Plus className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            Add rule entry
          </button>
        </div>
      )}

      <ChooseExistingVnextComponentDialog
        open={pickerTarget != null}
        onOpenChange={(open) => {
          if (!open) setPickerTarget(null);
        }}
        category={config.category}
        onSelect={handleSelectComponent}
      />
      <CreateNewComponentDialog
        open={creatorTarget != null}
        onOpenChange={(open) => {
          if (!open) setCreatorTarget(null);
        }}
        category={config.category}
        onCreated={handleSelectComponent}
      />
    </div>
  );
}

/* ────────────── Presentational pieces ────────────── */

function SlotHeader({ label, hint }: { label: string; hint: string }) {
  return (
    <div>
      <span className="text-primary-text/75 block text-xs font-semibold">{label}</span>
      <span className="text-muted-foreground block text-[10px] leading-tight">{hint}</span>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
        active
          ? 'bg-surface text-foreground ring-border shadow-sm ring-1'
          : 'text-muted-foreground hover:text-foreground'
      }`}>
      {label}
    </button>
  );
}

function SlotPickActions({
  kind,
  canPickExisting,
  onPick,
  onCreate,
}: {
  kind: SlotKind;
  canPickExisting: boolean;
  onPick: () => void;
  onCreate: () => void;
}) {
  const { category } = SLOT_KINDS[kind];
  const disabledTitle = 'Requires an open project and vnext.config.json with paths';
  return (
    <div
      className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
      role="group"
      aria-label={`Attach ${SLOT_KINDS[kind].noun}`}>
      <ChooseFromExistingVnextComponentButton
        category={category}
        onClick={onPick}
        disabled={!canPickExisting}
        title={canPickExisting ? undefined : disabledTitle}
      />
      <CreateNewComponentButton category={category} onClick={onCreate} disabled={!canPickExisting} />
    </div>
  );
}

/**
 * One resolved reference. The `{ ref: './file.json' }` form is shown
 * read-only — the editor never authors it, but it is valid on the wire so
 * it must survive being displayed.
 */
function ComponentRefRow({
  ref_,
  onRemove,
  onReplace,
  canPickExisting,
  onBeforeOpenModal,
  noun,
}: {
  ref_: FunctionComponentRef;
  onRemove: () => void;
  onReplace: () => void;
  canPickExisting: boolean;
  onBeforeOpenModal?: () => void;
  noun: string;
}) {
  if (isComponentFileRef(ref_)) {
    return (
      <div className="bg-surface border-border flex items-start gap-2 rounded-lg border px-2.5 py-2">
        <FileJson className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <span className="text-foreground block font-mono text-[11px] font-semibold">
            {ref_.ref}
          </span>
          <span className="text-muted-foreground block text-[10px]">
            File reference — edit the JSON directly to change the path.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onReplace}
            disabled={!canPickExisting}
            className="text-secondary-icon hover:text-secondary-foreground cursor-pointer text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45">
            Replace
          </button>
          <IconAction label={`Remove ${noun} reference`} destructive onClick={onRemove}>
            <Trash2 size={12} />
          </IconAction>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border-border hover:border-muted-border-hover flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-all">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground font-mono text-[11px] font-semibold tracking-tight">
            {ref_.key || '?'}
          </span>
          {ref_.domain ? (
            <span className="text-muted-foreground text-[10px]">@{ref_.domain}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {ref_.version ? (
            <span className="text-muted-foreground font-mono text-[9px]">v{ref_.version}</span>
          ) : null}
          {ref_.flow ? (
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-[9px]">
              {ref_.flow}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onReplace}
          disabled={!canPickExisting}
          className="text-secondary-icon hover:text-secondary-foreground cursor-pointer text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45">
          Replace
        </button>
        {ref_.key && ref_.flow ? (
          <div onClickCapture={onBeforeOpenModal}>
            <OpenVnextComponentInModalButton
              componentKey={String(ref_.key)}
              flow={String(ref_.flow)}
              className="shrink-0 rounded-lg p-1"
              title={`Open ${noun} JSON in editor (modal)`}
              iconOnly
            />
          </div>
        ) : null}
        <IconAction label={`Remove ${noun} reference`} destructive onClick={onRemove}>
          <Trash2 size={12} />
        </IconAction>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`text-subtle cursor-pointer rounded-lg p-1 transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
        destructive
          ? 'hover:text-destructive-text hover:bg-destructive-surface'
          : 'hover:text-foreground hover:bg-secondary/60'
      }`}>
      {children}
    </button>
  );
}

/* ────────────── Internals ────────────── */

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function previewJson(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
