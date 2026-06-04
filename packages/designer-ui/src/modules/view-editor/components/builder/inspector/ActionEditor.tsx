/**
 * Editor for Button.action / Card.onTap / ListTile.onTap fields.
 *
 * SDK v0.2.0+ (`forgeactionmodelintegration.md`, `view-vocabulary.md`):
 *   - Three reserved verbs: `submit`, `select`, `reset` — special SDK
 *     behaviour (validate / inline-set / clear).
 *   - Anything else is opaque to the SDK and dispatched to
 *     `delegate.onAction` with the optional `command` field.
 *   - Domain dispatch convention uses `action: "dispatch"` + a URN
 *     in `command`. Forge surfaces those URNs from the workspace
 *     catalog (workflow transitions + BFF functions).
 *   - `ActionDescriptor.validate` opts any verb into form
 *     validation; the SDK runs `validateAllFields()` first.
 *
 * The picker is gated by `getComponentMeta(nodeType).actionCapability`:
 *   - `reservedActions` — which reserved verbs are surfaced
 *   - `acceptsDispatch` — whether to show the URN catalog + custom
 *     URN section
 *   - `acceptsValidateFlag` — whether to show the validate checkbox
 *
 * Single mode (Button.action): the SDK reads
 * `action` / `command` / `validate` as three SIBLING fields on the
 * node. Picker writes via `onChange` (action) + `onSiblingChange`
 * (command / validate). Card legacy `onTap` alias is read by the
 * caller (PropertyInspector) and projected onto the `action` field
 * for editing.
 *
 * Multi mode (Card.onTap or ListTile.onTap as
 * `ActionDescriptor[]`): each row is a descriptor that carries its
 * own `command` / `bind` / `value` / `validate` INSIDE. The picker
 * writes to the descriptor object only; there is no sibling field
 * concept in array form.
 */

import { useMemo, useState } from 'react';
import { MoveDown, MoveUp, Plus, Trash2, Workflow, Zap, X } from 'lucide-react';
import {
  STANDARD_ACTIONS,
  getComponentMeta,
  type ReservedAction,
} from '@burgan-tech/pseudo-ui';

import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { useUrnCatalog } from '../services/UrnCatalogContext';
import type { DomainActionEntry } from '../services/forgeUrnCatalog';
import { ChooseUrnDialog } from './ChooseUrnDialog';

// ── Public API ─────────────────────────────────────────────────────────

export interface ActionEditorProps {
  value: unknown;
  onChange: (next: unknown) => void;
  multi?: boolean;
  /** Node type for actionCapability lookup. PropertyInspector passes `node.type`. */
  nodeType?: string;
  /** Sibling field setter (single mode). Used to write `command` / `validate`
   *  peer fields when the picker selects a domain dispatch URN. */
  onSiblingChange?: (key: string, value: unknown) => void;
  /** Current sibling values (single mode), so the editor can render
   *  the validate checkbox and surface the existing URN in the picker. */
  command?: unknown;
  validate?: unknown;
  /** When true, capability comes from `componentMeta.itemActionCapability`
   *  instead of `actionCapability`. Used by `ItemsField` for the
   *  per-item picker inside NavigationDrawer / Menu containers. */
  useItemCapability?: boolean;
}

// ── Internal types ─────────────────────────────────────────────────────

interface ActionDescriptor {
  action: string;
  command?: string;
  bind?: string;
  value?: unknown;
  validate?: boolean;
  // R26 — SDK-side pre/post action hooks. Each hook is itself a
  // descriptor that the SDK fires through `delegate.onAction` with
  // `context.phase = 'pre' | 'post'`. The Forge host treats these as
  // placeholders today (see createQuickRunPseudoDelegate.ts) but
  // authoring is fully supported so views can declare them now.
  preHooks?: ActionDescriptor[];
  postHooks?: ActionDescriptor[];
  /**
   * Hook-only marker; meaningful only inside `preHooks[]` /
   * `postHooks[]` entries. `sync: true` tells the SDK to await this
   * hook before moving on to the main / post phase.
   */
  sync?: boolean;
}

type ActionLike = string | ActionDescriptor;

const RESERVED_VERBS: ReservedAction[] = ['submit', 'select', 'reset'];

// ── Helpers ────────────────────────────────────────────────────────────

function toArray(value: unknown): ActionLike[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as ActionLike[];
  return [value as ActionLike];
}

function isDescriptor(value: unknown): value is ActionDescriptor {
  return typeof value === 'object' && value !== null && 'action' in (value as object);
}

function isReservedVerb(verb: string | undefined): verb is ReservedAction {
  return !!verb && RESERVED_VERBS.includes(verb as ReservedAction);
}

function shouldValidateDefault(verb: string | undefined): boolean {
  // Mirror SDK `shouldValidateAction`: submit defaults true, others false.
  return verb === 'submit';
}

interface PickerEntry {
  /** Stable id used as the <option value>. Reserved verbs encode as `reserved:<verb>`,
   *  catalog entries as `urn:...`, sentinels as `__custom__` / `__descriptor__`. */
  id: string;
  /** Human label shown in the dropdown. */
  label: string;
  /** Group label (optgroup heading). */
  group: 'Reserved' | 'Workflow' | 'Function' | 'Custom URN' | 'Descriptor';
}

interface ActionCapability {
  reservedActions: ReservedAction[];
  acceptsDispatch: boolean;
  acceptsValidateFlag: boolean;
}

function readCapability(nodeType: string | undefined, useItemCapability = false): ActionCapability {
  if (!nodeType) {
    // Defensive fallback — full Button-like capability.
    return { reservedActions: ['submit', 'reset'], acceptsDispatch: true, acceptsValidateFlag: true };
  }
  const meta = getComponentMeta(nodeType);
  // R25.A-5: NavigationDrawer / Menu carry per-item action picker
  // metadata under `itemActionCapability`; top-level `actionCapability`
  // is usually absent on container nodes. ItemsField passes
  // `useItemCapability=true` so the picker gates on the item-level
  // contract (reserved=['select'], acceptsDispatch=true,
  // acceptsValidateFlag=false) instead of the container default.
  const cap = useItemCapability ? meta?.itemActionCapability : meta?.actionCapability;
  return {
    reservedActions: (cap?.reservedActions ?? []) as ReservedAction[],
    acceptsDispatch: cap?.acceptsDispatch ?? false,
    acceptsValidateFlag: cap?.acceptsValidateFlag ?? false,
  };
}

// ── Entry point ────────────────────────────────────────────────────────

export function ActionEditor({
  value,
  onChange,
  multi,
  nodeType,
  onSiblingChange,
  command,
  validate,
  useItemCapability,
}: ActionEditorProps) {
  if (multi) {
    return (
      <MultiActionEditor
        value={value}
        onChange={onChange}
        nodeType={nodeType}
        useItemCapability={useItemCapability}
      />
    );
  }
  return (
    <SingleActionEditor
      value={value}
      onChange={onChange}
      nodeType={nodeType}
      onSiblingChange={onSiblingChange}
      command={typeof command === 'string' ? command : undefined}
      validate={typeof validate === 'boolean' ? validate : undefined}
      useItemCapability={useItemCapability}
    />
  );
}

// ── Single mode ────────────────────────────────────────────────────────

function SingleActionEditor({
  value,
  onChange,
  nodeType,
  onSiblingChange,
  command,
  validate,
  useItemCapability,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  nodeType: string | undefined;
  onSiblingChange?: (key: string, value: unknown) => void;
  command: string | undefined;
  validate: boolean | undefined;
  useItemCapability?: boolean;
}) {
  const urnCatalog = useUrnCatalog();
  const capability = readCapability(nodeType, useItemCapability);

  const verb = typeof value === 'string' ? value : isDescriptor(value) ? value.action : '';
  const [pickerOpen, setPickerOpen] = useState(false);

  // R25.D-1: descriptor + custom-URN modes are now explicit user toggles
  // instead of sentinel-driven Select options. We persist them in
  // component state so the inputs don't disappear on every keystroke.
  const startsInDescriptor = isDescriptor(value);
  const startsInCustom = isUnknownDispatchUrn(verb, command, urnCatalog);
  const [descriptorMode, setDescriptorMode] = useState(startsInDescriptor);
  const [customMode, setCustomMode] = useState(startsInCustom);

  const selectedCatalogEntry = useMemo(
    () => (command ? findCatalogEntry(command, urnCatalog) : undefined),
    [command, urnCatalog],
  );

  const showValidate = capability.acceptsValidateFlag && verb !== 'submit';
  const validateEffective = validate ?? shouldValidateDefault(verb);

  // ── Action callbacks ─────────────────────────────────────────────
  const pickReservedVerb = (rv: ReservedAction) => {
    setDescriptorMode(false);
    setCustomMode(false);
    applySelection(`reserved:${rv}`, { onChange, onSiblingChange, urnCatalog });
  };
  const pickUrnEntry = (entry: DomainActionEntry) => {
    setDescriptorMode(false);
    setCustomMode(false);
    applySelection(entry.urn, { onChange, onSiblingChange, urnCatalog });
  };
  const clearUrn = () => {
    setCustomMode(false);
    onSiblingChange?.('command', undefined);
    if (capability.reservedActions[0]) {
      applySelection(`reserved:${capability.reservedActions[0]}`, { onChange, onSiblingChange, urnCatalog });
    } else {
      onChange('');
    }
  };
  const toggleDescriptor = (next: boolean) => {
    setDescriptorMode(next);
    if (next) {
      setCustomMode(false);
      applySelection('__descriptor__', { onChange, onSiblingChange, urnCatalog });
    } else if (capability.reservedActions[0]) {
      // Snap back to the first reserved verb when leaving descriptor mode.
      applySelection(`reserved:${capability.reservedActions[0]}`, { onChange, onSiblingChange, urnCatalog });
    }
  };
  const toggleCustom = (next: boolean) => {
    setCustomMode(next);
    if (next) {
      setDescriptorMode(false);
      applySelection('__custom__', { onChange, onSiblingChange, urnCatalog });
    } else if (capability.reservedActions[0]) {
      onSiblingChange?.('command', undefined);
      applySelection(`reserved:${capability.reservedActions[0]}`, { onChange, onSiblingChange, urnCatalog });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Reserved verb chips — quick toggles for the SDK's three special verbs. */}
      {capability.reservedActions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {capability.reservedActions.map((rv) => {
            const active = !descriptorMode && !customMode && !command && verb === rv;
            return (
              <button
                key={rv}
                type="button"
                onClick={() => pickReservedVerb(rv)}
                className={`rounded border px-2 py-0.5 text-[10px] transition ${
                  active
                    ? 'border-primary-border bg-primary text-foreground'
                    : 'border-primary-border bg-primary-surface text-muted-text hover:bg-primary'
                }`}
                title={STANDARD_ACTIONS[rv]?.label ?? rv}
              >
                {rv}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* URN picker — dispatch dispatchers. Hidden when capability says no dispatch. */}
      {capability.acceptsDispatch && !descriptorMode && !customMode ? (
        selectedCatalogEntry || (verb === 'dispatch' && command) ? (
          <div className="flex items-center justify-between gap-1 rounded border border-primary-border bg-primary px-2 py-1">
            <span className="flex min-w-0 items-center gap-1">
              {selectedCatalogEntry?.group === 'function' ? (
                <Zap size={11} className="text-muted-text shrink-0" />
              ) : (
                <Workflow size={11} className="text-muted-text shrink-0" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-foreground truncate text-[11px] font-medium">
                  {selectedCatalogEntry?.label ?? 'Custom URN'}
                </span>
                <span className="text-muted-text truncate font-mono text-[9px]">{command}</span>
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-muted-text hover:text-foreground rounded px-1.5 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
              >
                Change…
              </button>
              <button
                type="button"
                onClick={clearUrn}
                aria-label="Clear URN"
                className="text-muted-text hover:text-foreground rounded p-0.5 hover:bg-[var(--vscode-list-hoverBackground)]"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="hover:bg-primary flex items-center gap-1 self-start rounded border border-dashed border-primary-border bg-primary-surface px-2 py-1 text-[11px] text-muted-text"
          >
            <Workflow size={11} />
            Pick workflow / function URN…
          </button>
        )
      ) : null}

      {/* Custom URN inline input. */}
      {customMode ? (
        <Input
          size="sm"
          value={command ?? ''}
          onChange={(e) => {
            const next = e.target.value;
            onSiblingChange?.('command', next || undefined);
            if (verb !== 'dispatch') onChange('dispatch');
          }}
          placeholder="urn:tenant:..."
          aria-label="Custom command URN"
        />
      ) : null}

      {/* Descriptor mode — bind/value editor for `select` pattern. */}
      {descriptorMode || isDescriptor(value) ? (
        <DescriptorFields
          descriptor={isDescriptor(value) ? value : { action: verb || 'select' }}
          onChange={(d) => onChange(d)}
        />
      ) : null}

      {/* Mode toggles — Custom URN + Descriptor checkboxes. */}
      {capability.acceptsDispatch ? (
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-text">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={customMode}
              onChange={(e) => toggleCustom(e.target.checked)}
              disabled={descriptorMode}
            />
            Custom URN
          </label>
          {capability.reservedActions.includes('select') ? (
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={descriptorMode}
                onChange={(e) => toggleDescriptor(e.target.checked)}
                disabled={customMode}
              />
              With bind / value (select pattern)
            </label>
          ) : null}
        </div>
      ) : null}

      <ChooseUrnDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        catalog={urnCatalog}
        onSelect={pickUrnEntry}
      />

      {/* Validate checkbox (acceptsValidateFlag && verb !== 'submit'). */}
      {showValidate ? (
        <label className="flex items-center gap-1 text-[10px] text-muted-text">
          <input
            type="checkbox"
            checked={validateEffective}
            onChange={(e) => onSiblingChange?.('validate', e.target.checked || undefined)}
          />
          Validate form before dispatch
        </label>
      ) : null}

      {/* Hint line. */}
      <p className="text-[10px] italic text-secondary-text">
        {hintFor(
          descriptorMode
            ? '__descriptor__'
            : customMode
            ? '__custom__'
            : selectedCatalogEntry?.urn ?? (verb ? `reserved:${verb}` : ''),
          verb,
          capability,
        )}
      </p>

      {/* R26 — Pre / Post action hooks. Available for both reserved
          primitive verbs (submit / reset / select) and descriptor
          dispatches. When the value is still a bare string verb,
          adding the first hook promotes it to a descriptor object so
          the hook arrays have somewhere to live; clearing all hooks
          on a non-reserved descriptor leaves the descriptor intact
          (we don't down-grade back to a string to avoid clobbering
          bind/value/validate that may still be set). */}
      {verb ? (
        <>
          <HookListEditor
            title="Pre hooks"
            hooks={isDescriptor(value) ? value.preHooks ?? [] : []}
            onChange={(next) => writeHooks('preHooks', next, value, verb, onChange)}
            showSync
          />
          <HookListEditor
            title="Post hooks"
            hooks={isDescriptor(value) ? value.postHooks ?? [] : []}
            onChange={(next) => writeHooks('postHooks', next, value, verb, onChange)}
            showSync={false}
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * Write a hook list back to the parent action value. Promotes a bare
 * verb string into a descriptor object on first hook add so reserved
 * verbs (submit / reset / …) can carry pre/post arrays. When the
 * descriptor ends up with no other meaningful fields after a clear,
 * we collapse it back to a bare string to keep the JSON tidy.
 */
function writeHooks(
  field: 'preHooks' | 'postHooks',
  next: ActionDescriptor[],
  current: unknown,
  verb: string,
  onChange: (value: unknown) => void,
): void {
  const isEmpty = next.length === 0;

  if (isDescriptor(current)) {
    const updated: ActionDescriptor = {
      ...current,
      [field]: isEmpty ? undefined : next,
    };
    // If we just cleared hooks and the descriptor carries no other
    // distinguishing fields, fall back to the bare verb string for a
    // clean round-trip.
    const otherFieldsSet =
      updated.command !== undefined ||
      updated.bind !== undefined ||
      updated.value !== undefined ||
      updated.validate !== undefined ||
      (updated.preHooks?.length ?? 0) > 0 ||
      (updated.postHooks?.length ?? 0) > 0;
    if (!otherFieldsSet) {
      onChange(updated.action);
      return;
    }
    onChange(updated);
    return;
  }

  // String verb path — promote to a descriptor only when we actually
  // have hooks to attach. Clearing-into-empty stays a string.
  if (isEmpty) {
    onChange(typeof current === 'string' ? current : verb);
    return;
  }
  const promoted: ActionDescriptor = { action: verb, [field]: next };
  onChange(promoted);
}

// ── Hooks editor (R26 pre/post action hooks) ──────────────────────────

interface HookListEditorProps {
  title: string;
  hooks: ActionDescriptor[];
  onChange: (next: ActionDescriptor[]) => void;
  /**
   * Surface the `sync` checkbox per row. Pre hooks honour it; post
   * hooks are always fire-and-forget per the SDK contract, so
   * the column is hidden there to avoid authoring confusion.
   */
  showSync: boolean;
}

function HookListEditor({ title, hooks, onChange, showSync }: HookListEditorProps) {
  const [open, setOpen] = useState(false);

  const add = () => {
    onChange([...hooks, { action: 'audit', command: '' } as ActionDescriptor]);
    setOpen(true);
  };

  const update = (index: number, next: ActionDescriptor) => {
    const list = hooks.slice();
    list[index] = next;
    onChange(list);
  };

  const remove = (index: number) => {
    onChange(hooks.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-2 rounded border border-primary-border bg-primary/30 p-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1 text-left"
        aria-expanded={open}>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary-text">
          {title}
          {hooks.length > 0 ? (
            <span className="ml-1 text-muted-text font-mono normal-case">({hooks.length})</span>
          ) : null}
        </span>
        <span className="text-[10px] text-muted-text">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="mt-1.5 space-y-1.5">
          {hooks.length === 0 ? (
            <p className="text-[10px] italic text-muted-text">
              No {title.toLowerCase()} configured.
            </p>
          ) : (
            hooks.map((hook, i) => (
              <HookRow
                key={i}
                hook={hook}
                onChange={(next) => update(i, next)}
                onRemove={() => remove(i)}
                showSync={showSync}
              />
            ))
          )}
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-secondary-icon hover:text-secondary-foreground">
            <Plus size={11} />
            Add hook
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface HookRowProps {
  hook: ActionDescriptor;
  onChange: (next: ActionDescriptor) => void;
  onRemove: () => void;
  showSync: boolean;
}

function HookRow({ hook, onChange, onRemove, showSync }: HookRowProps) {
  const urnCatalog = useUrnCatalog();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="rounded border border-border-subtle bg-surface p-2">
      <div className="grid grid-cols-[1fr_auto] gap-1.5 items-start">
        <div className="flex flex-col gap-1.5">
          <div>
            <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
              Action verb
            </label>
            <Input
              size="sm"
              value={hook.action ?? ''}
              onChange={(e) => onChange({ ...hook, action: e.target.value })}
              placeholder="audit / telemetry / …"
              aria-label="Hook action verb"
            />
          </div>
          <div>
            <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
              Command URN
            </label>
            <div className="flex items-center gap-1">
              <Input
                size="sm"
                value={hook.command ?? ''}
                onChange={(e) =>
                  onChange({ ...hook, command: e.target.value || undefined })
                }
                placeholder="urn:client:audit:click"
                className="flex-1"
                aria-label="Hook command URN"
              />
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded border border-border-subtle px-1.5 py-1 text-[10px] text-secondary-icon hover:bg-[var(--vscode-list-hoverBackground)]"
                title="Pick URN from workspace catalog">
                Pick…
              </button>
            </div>
          </div>
          {showSync ? (
            <label className="flex items-center gap-1 text-[10px] text-muted-text">
              <input
                type="checkbox"
                checked={hook.sync === true}
                onChange={(e) =>
                  onChange({
                    ...hook,
                    sync: e.target.checked ? true : undefined,
                  })
                }
              />
              Await before next phase (<code>sync</code>)
            </label>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-subtle hover:text-destructive-text hover:bg-destructive-surface rounded p-1 transition-colors"
          aria-label="Remove hook"
          title="Remove hook">
          <Trash2 size={11} />
        </button>
      </div>

      <ChooseUrnDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        catalog={urnCatalog}
        onSelect={(entry) => onChange({ ...hook, command: entry.urn })}
      />
    </div>
  );
}

// ── Picker entry building ─────────────────────────────────────────────

function buildPickerEntries(
  capability: ActionCapability,
  urnCatalog: ReturnType<typeof useUrnCatalog>,
): PickerEntry[] {
  const entries: PickerEntry[] = [];

  for (const verb of capability.reservedActions) {
    const spec = STANDARD_ACTIONS[verb];
    entries.push({
      id: `reserved:${verb}`,
      label: spec?.label ? `${verb} — ${spec.label}` : verb,
      group: 'Reserved',
    });
  }

  if (capability.acceptsDispatch) {
    for (const wf of urnCatalog.workflows) {
      entries.push({ id: wf.urn, label: wf.label, group: 'Workflow' });
    }
    for (const fn of urnCatalog.functions) {
      entries.push({ id: fn.urn, label: fn.label, group: 'Function' });
    }
    entries.push({ id: '__custom__', label: 'Custom URN…', group: 'Custom URN' });
    // Descriptor mode for select patterns (only when reserved 'select' is offered).
    if (capability.reservedActions.includes('select')) {
      entries.push({ id: '__descriptor__', label: 'Descriptor (bind / value)…', group: 'Descriptor' });
    }
  }

  return entries;
}

function renderEntriesGrouped(entries: PickerEntry[], selectionId: string) {
  const groups = new Map<string, PickerEntry[]>();
  for (const e of entries) {
    const arr = groups.get(e.group) ?? [];
    arr.push(e);
    groups.set(e.group, arr);
  }

  // Defensive: include a hidden option matching the current selection
  // even if no group catches it (e.g. legacy persisted verb).
  const hasMatch = entries.some((e) => e.id === selectionId);

  return (
    <>
      {!hasMatch && selectionId ? (
        <option value={selectionId}>{`Current: ${selectionId}`}</option>
      ) : null}
      {[...groups.entries()].map(([group, list]) => (
        <optgroup key={group} label={group}>
          {list.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

function inferSelectionId(
  verb: string,
  command: string | undefined,
  urnCatalog: ReturnType<typeof useUrnCatalog>,
): string {
  if (isReservedVerb(verb)) return `reserved:${verb}`;
  if (command) {
    const match = findCatalogEntry(command, urnCatalog);
    if (match) return match.urn;
    return '__custom__';
  }
  if (verb === 'dispatch') return '__custom__';
  return verb ? `reserved:${verb}` : '';
}

function findCatalogEntry(
  urn: string,
  urnCatalog: ReturnType<typeof useUrnCatalog>,
): DomainActionEntry | undefined {
  return (
    urnCatalog.workflows.find((e) => e.urn === urn) ??
    urnCatalog.functions.find((e) => e.urn === urn)
  );
}

function isUnknownDispatchUrn(
  verb: string,
  command: string | undefined,
  urnCatalog: ReturnType<typeof useUrnCatalog>,
): boolean {
  if (!command) return false;
  if (verb !== 'dispatch') return false;
  return !findCatalogEntry(command, urnCatalog);
}

// ── Selection apply ────────────────────────────────────────────────────

function applySelection(
  selectionId: string,
  ctx: {
    onChange: (next: unknown) => void;
    onSiblingChange?: (key: string, value: unknown) => void;
    urnCatalog: ReturnType<typeof useUrnCatalog>;
  },
) {
  if (selectionId.startsWith('reserved:')) {
    const verb = selectionId.slice('reserved:'.length);
    ctx.onChange(verb);
    // Reserved verbs typically clear command; submit may keep host-context command.
    if (verb !== 'submit') ctx.onSiblingChange?.('command', undefined);
    // Validate flag: reset to default (undefined → SDK uses verb default).
    ctx.onSiblingChange?.('validate', undefined);
    return;
  }
  if (selectionId === '__custom__') {
    ctx.onChange('dispatch');
    // Don't touch command/validate — user types them.
    return;
  }
  if (selectionId === '__descriptor__') {
    ctx.onChange({ action: 'select' });
    ctx.onSiblingChange?.('command', undefined);
    return;
  }
  // Otherwise: URN catalog entry.
  const entry = findCatalogEntry(selectionId, ctx.urnCatalog);
  if (!entry) {
    // Unknown id — leave state alone.
    return;
  }
  ctx.onChange('dispatch');
  ctx.onSiblingChange?.('command', entry.urn);
  ctx.onSiblingChange?.('validate', entry.defaultValidate);
}

// ── Hint copy ──────────────────────────────────────────────────────────

function hintFor(
  selectionId: string,
  verb: string,
  capability: ActionCapability,
): string {
  if (!selectionId) return '';
  if (selectionId.startsWith('reserved:')) {
    const v = selectionId.slice('reserved:'.length);
    if (v === 'submit') return 'Runs form validation, then dispatches. Pair with a `command` URN for workflow transitions.';
    if (v === 'reset') return 'SDK clears formData + errors, then notifies the host.';
    if (v === 'select') return 'Use the descriptor mode below to set `bind` / `value` (host is NOT called).';
    return '';
  }
  if (selectionId === '__custom__') {
    return 'Custom URN — SDK forwards the command as-is to the host delegate. Validation is opt-in via the checkbox.';
  }
  if (selectionId === '__descriptor__') {
    return 'Inline descriptor — for `select` set bind + value; host delegate is NOT called for select.';
  }
  // Catalog entry
  const isFunction = selectionId.startsWith('urn:amorphie:func:');
  if (isFunction) return 'Workspace function — SDK forwards via `delegate.onAction(\'dispatch\', formData, urn)`.';
  return `Workflow transition${capability.acceptsValidateFlag ? ' — toggle validate below to gate the form' : ''}.`;
}

// ── Descriptor fields (select / bind / value) ─────────────────────────

function DescriptorFields({
  descriptor,
  onChange,
}: {
  descriptor: ActionDescriptor;
  onChange: (next: ActionDescriptor) => void;
}) {
  return (
    <>
      <Input
        size="sm"
        value={descriptor.bind ?? ''}
        onChange={(e) => onChange({ ...descriptor, bind: e.target.value || undefined })}
        placeholder="bind (e.g. $ui.dialogOpen)"
        aria-label="bind"
      />
      <Input
        size="sm"
        value={
          typeof descriptor.value === 'string'
            ? descriptor.value
            : descriptor.value !== undefined
            ? JSON.stringify(descriptor.value)
            : ''
        }
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange({ ...descriptor, value: undefined });
            return;
          }
          try {
            onChange({ ...descriptor, value: JSON.parse(raw) });
          } catch {
            onChange({ ...descriptor, value: raw });
          }
        }}
        placeholder='value (literal or expression, e.g. "$item.value")'
        aria-label="value"
      />
    </>
  );
}

// ── Multi mode (Card.onTap[], ListTile.onTap[]) ───────────────────────

function MultiActionEditor({
  value,
  onChange,
  nodeType,
  useItemCapability,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  nodeType: string | undefined;
  useItemCapability?: boolean;
}) {
  const list = useMemo(() => toArray(value), [value]);
  const urnCatalog = useUrnCatalog();
  const capability = readCapability(nodeType, useItemCapability);

  const update = (next: ActionLike[]) => {
    onChange(next.length === 0 ? undefined : next.length === 1 ? next[0] : next);
  };

  return (
    <div className="flex flex-col gap-2">
      {list.length === 0 ? (
        <p className="text-[11px] text-muted-text">No actions configured.</p>
      ) : (
        list.map((item, index) => (
          <div key={index} className="rounded border border-primary-border bg-primary p-2">
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary-text">
                Action {index + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Move action up"
                  disabled={index === 0}
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => {
                    if (index === 0) return;
                    const next = list.slice();
                    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                    update(next);
                  }}
                >
                  <MoveUp size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Move action down"
                  disabled={index === list.length - 1}
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => {
                    if (index === list.length - 1) return;
                    const next = list.slice();
                    [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
                    update(next);
                  }}
                >
                  <MoveDown size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Remove action"
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground"
                  onClick={() => {
                    const next = list.slice();
                    next.splice(index, 1);
                    update(next);
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            <DescriptorRow
              descriptor={toDescriptor(item)}
              onChange={(d) => {
                const next = list.slice();
                next[index] = d;
                update(next);
              }}
              capability={capability}
              urnCatalog={urnCatalog}
            />
          </div>
        ))
      )}
      <button
        type="button"
        className="flex items-center gap-1 self-start rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
        onClick={() => update([...list, { action: 'select' } as ActionDescriptor])}
      >
        <Plus size={11} /> Add action
      </button>
    </div>
  );
}

function toDescriptor(item: ActionLike): ActionDescriptor {
  if (isDescriptor(item)) return item;
  if (typeof item === 'string') return { action: item };
  return { action: 'select' };
}

function DescriptorRow({
  descriptor,
  onChange,
  capability,
  urnCatalog,
}: {
  descriptor: ActionDescriptor;
  onChange: (next: ActionDescriptor) => void;
  capability: ActionCapability;
  urnCatalog: ReturnType<typeof useUrnCatalog>;
}) {
  // In multi mode, command/validate live INSIDE the descriptor, so the
  // row owns its own picker scoped to this single descriptor object.
  const selectionId = useMemo(
    () => inferSelectionId(descriptor.action, descriptor.command, urnCatalog),
    [descriptor.action, descriptor.command, urnCatalog],
  );
  const entries = useMemo(
    () => buildPickerEntries(capability, urnCatalog),
    [capability, urnCatalog],
  );

  const showValidate = capability.acceptsValidateFlag && descriptor.action !== 'submit';
  const validateEffective = descriptor.validate ?? shouldValidateDefault(descriptor.action);
  const showDescriptorFields =
    selectionId === '__descriptor__' || descriptor.action === 'select';
  const showCustomUrn =
    selectionId === '__custom__' ||
    (descriptor.command !== undefined &&
      descriptor.action === 'dispatch' &&
      !findCatalogEntry(descriptor.command ?? '', urnCatalog));

  return (
    <div className="flex flex-col gap-1">
      <Select
        className="h-8 text-xs"
        value={selectionId}
        onChange={(e) => {
          const nextId = e.target.value;
          applySelection(nextId, {
            onChange: (next) => {
              if (typeof next === 'string') {
                onChange({ ...descriptor, action: next });
              } else if (isDescriptor(next)) {
                onChange({ ...descriptor, ...next });
              }
            },
            onSiblingChange: (key, val) => onChange({ ...descriptor, [key]: val }),
            urnCatalog,
          });
        }}
        aria-label="Action"
      >
        {entries.length === 0 ? (
          <option value="">— no actions available —</option>
        ) : (
          renderEntriesGrouped(entries, selectionId)
        )}
      </Select>

      {showCustomUrn ? (
        <Input
          size="sm"
          value={descriptor.command ?? ''}
          onChange={(e) => {
            const next = e.target.value || undefined;
            onChange({ ...descriptor, action: 'dispatch', command: next });
          }}
          placeholder="urn:tenant:..."
          aria-label="Custom command URN"
        />
      ) : null}

      {showDescriptorFields ? (
        <DescriptorFields
          descriptor={descriptor}
          onChange={(d) => onChange(d)}
        />
      ) : null}

      {showValidate ? (
        <label className="flex items-center gap-1 text-[10px] text-muted-text">
          <input
            type="checkbox"
            checked={validateEffective}
            onChange={(e) =>
              onChange({ ...descriptor, validate: e.target.checked || undefined })
            }
          />
          Validate form before dispatch
        </label>
      ) : null}

      <p className="text-[10px] italic text-secondary-text">
        {hintFor(selectionId, descriptor.action, capability)}
      </p>
    </div>
  );
}
