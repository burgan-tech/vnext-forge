import type { ResourceReference } from '@vnext-forge-studio/vnext-types';
import { EditableInput, IconPlus, IconTrash } from '../PropertyPanelShared';
import { KeyCombobox } from './KeyCombobox';
import { nextOverrideKey, renameRecordKey } from './subFlowOverrides';

/**
 * The schema's `reference` definition is `oneOf` an explicit
 * `{ key, domain, flow, version }` or a shorthand `{ ref: "…" }` pointing at
 * a component file. `ResourceReference` only models the explicit form, so a
 * value loaded from disk can structurally be the shorthand form even though
 * it is typed as `ResourceReference` here — read it duck-typed rather than
 * assuming the type is accurate, and never spread into it.
 */
export interface RefFormReference {
  ref: string;
}

export function isRefForm(replacement: ResourceReference): replacement is ResourceReference & RefFormReference {
  return typeof (replacement as unknown as RefFormReference).ref === 'string';
}

/**
 * Sets one field of an explicit-form replacement. A ref-form entry is left
 * untouched (returns the map unchanged) — it must never be spread into,
 * which would silently bolt `key`/`domain`/... onto a `{ ref }` object.
 */
export function patchViewSwapMap(
  map: Record<string, ResourceReference> | undefined,
  viewKey: string,
  field: keyof ResourceReference,
  text: string,
): Record<string, ResourceReference> | undefined {
  const current = map?.[viewKey];
  if (!current || isRefForm(current)) return map;
  return { ...map, [viewKey]: { ...current, [field]: text } };
}

/** Replaces a `{ ref: "…" }` entry with an empty explicit key/version/flow reference. */
export function convertViewSwapEntryToKeyVersion(
  map: Record<string, ResourceReference> | undefined,
  viewKey: string,
): Record<string, ResourceReference> {
  return { ...map, [viewKey]: { ...EMPTY_REF } };
}

const EMPTY_REF: ResourceReference = { key: '', domain: '', version: '1.0.0', flow: 'sys-views' };

interface ViewSwapMapEditorProps {
  /** Key = the view key the child selected; value = the replacement view. */
  value: Record<string, ResourceReference> | undefined;
  /** View keys the child can select in this state / transition. */
  viewKeyOptions: string[];
  onChange: (next: Record<string, ResourceReference> | undefined) => void;
  /** Opens the view picker for one entry; omitted when no project is open. */
  onBrowse?: (viewKey: string) => void;
}

export function ViewSwapMapEditor({ value, viewKeyOptions, onChange, onBrowse }: ViewSwapMapEditorProps) {
  const entries = Object.entries(value ?? {});

  const write = (next: Record<string, ResourceReference>): void => {
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  const add = (): void => {
    const next = { ...(value ?? {}) };
    next[nextOverrideKey(next, viewKeyOptions, 'view')] = { ...EMPTY_REF };
    write(next);
  };

  const rename = (from: string, to: string): void => {
    const next = { ...(value ?? {}) };
    if (renameRecordKey(next, from, to)) write(next);
  };

  const remove = (viewKey: string): void => {
    const next = { ...(value ?? {}) };
    delete next[viewKey];
    write(next);
  };

  const patchRef = (viewKey: string, field: keyof ResourceReference, text: string): void => {
    const next = patchViewSwapMap(value, viewKey, field, text);
    if (next) write(next);
  };

  const convertToKeyVersion = (viewKey: string): void => {
    write(convertViewSwapEntryToKeyVersion(value, viewKey));
  };

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-medium text-muted-foreground block">View swaps</span>
      {entries.map(([viewKey, replacement]) => (
        <div key={viewKey} className="border border-border-subtle rounded-lg p-2 bg-surface/50 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <KeyCombobox
                value={viewKey}
                options={viewKeyOptions}
                onCommit={(to) => rename(viewKey, to)}
                ariaLabel="Child view key"
                placeholder="Child view key"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(viewKey)}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1 transition-all"
              aria-label={`Remove view swap ${viewKey}`}
              title={`Remove view swap ${viewKey}`}>
              <IconTrash />
            </button>
          </div>
          <span className="text-[9px] font-medium text-muted-foreground block">Replacement view</span>
          {isRefForm(replacement) ? (
            <div className="space-y-1.5">
              <code className="block w-full truncate rounded-xl border border-border bg-muted-surface px-3 py-2 text-xs text-foreground">
                {replacement.ref}
              </code>
              <button
                type="button"
                onClick={() => convertToKeyVersion(viewKey)}
                className="text-secondary-icon hover:text-secondary-foreground cursor-pointer text-[10px] font-semibold">
                Convert to key/version
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <EditableInput value={replacement.key} onChange={(v) => patchRef(viewKey, 'key', v)} mono placeholder="key" />
              <EditableInput value={replacement.domain} onChange={(v) => patchRef(viewKey, 'domain', v)} mono placeholder="domain" />
              <EditableInput value={replacement.version} onChange={(v) => patchRef(viewKey, 'version', v)} mono placeholder="version" />
              <EditableInput value={replacement.flow} onChange={(v) => patchRef(viewKey, 'flow', v)} mono placeholder="flow" />
            </div>
          )}
          {onBrowse && (
            <button
              type="button"
              onClick={() => onBrowse(viewKey)}
              className="text-secondary-icon hover:text-secondary-foreground cursor-pointer text-[10px] font-semibold">
              Choose view…
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
        <IconPlus />
        Add view swap
      </button>
    </div>
  );
}
