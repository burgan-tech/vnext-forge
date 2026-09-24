import type { ResourceReference } from '@vnext-forge-studio/vnext-types';
import { EditableInput, IconPlus, IconTrash } from '../PropertyPanelShared';
import { KeyCombobox } from './KeyCombobox';
import { nextOverrideKey, renameRecordKey } from './subFlowOverrides';

interface ViewSwapMapEditorProps {
  /** Key = the view key the child selected; value = the replacement view. */
  value: Record<string, ResourceReference> | undefined;
  /** View keys the child can select in this state / transition. */
  viewKeyOptions: string[];
  onChange: (next: Record<string, ResourceReference> | undefined) => void;
  /** Opens the view picker for one entry; omitted when no project is open. */
  onBrowse?: (viewKey: string) => void;
}

const EMPTY_REF: ResourceReference = { key: '', domain: '', version: '1.0.0', flow: 'sys-views' };

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
    const next = { ...(value ?? {}) };
    next[viewKey] = { ...next[viewKey], [field]: text };
    write(next);
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
          <div className="grid grid-cols-2 gap-1.5">
            <EditableInput value={replacement.key} onChange={(v) => patchRef(viewKey, 'key', v)} mono placeholder="key" />
            <EditableInput value={replacement.domain} onChange={(v) => patchRef(viewKey, 'domain', v)} mono placeholder="domain" />
            <EditableInput value={replacement.version} onChange={(v) => patchRef(viewKey, 'version', v)} mono placeholder="version" />
            <EditableInput value={replacement.flow} onChange={(v) => patchRef(viewKey, 'flow', v)} mono placeholder="flow" />
          </div>
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
