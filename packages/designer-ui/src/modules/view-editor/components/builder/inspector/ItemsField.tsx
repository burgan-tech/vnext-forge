/**
 * NavigationDrawer.items[] / Menu.items[] editor (R25.A-5).
 *
 * Per `forgeactionmodelintegration.md §3.4` + viewauthorguide §4.1
 * each entry in the items array is one of three discriminated shapes:
 *
 *   1. Tappable:
 *      { label: MultiLangText, icon?: string, action: ActionLike,
 *        command?: string, validate?: boolean, badge?: string }
 *   2. Divider:
 *      { divider: true }
 *   3. Section header:
 *      { header: MultiLangText }
 *
 * The action picker reuses `ActionEditor` (single mode), so authors
 * see the same workflow / function URN dialog they get on Button —
 * the chosen URN lands in `item.command`, the verb in `item.action`,
 * and optional validate flag in `item.validate`. SDK reads them via
 * `componentMeta.itemActionCapability` at render time.
 *
 * Editing of free-form text (header / badge) uses `MultiLangInput`
 * so multilingual labels stay consistent with the rest of the
 * inspector.
 */
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { ActionEditor } from './ActionEditor';
import { MultiLangInput } from './MultiLangInput';

const MATERIAL_ICON_HINT = 'Material Icons name (e.g. home, settings)';

type ItemKind = 'tappable' | 'divider' | 'header';

interface RawItem {
  /** Action verb when tappable. SDK rule: anything except 'select' is
   *  forwarded to delegate.onAction; 'select' is internal-only. */
  action?: unknown;
  /** Sibling field for dispatch URN (workflow / function / custom). */
  command?: unknown;
  /** Peer validate flag — pairs with action='dispatch'. */
  validate?: unknown;
  label?: unknown;
  icon?: unknown;
  badge?: unknown;
  divider?: unknown;
  header?: unknown;
  [extra: string]: unknown;
}

function asItemArray(value: unknown): RawItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is RawItem => typeof s === 'object' && s !== null);
}

function itemKind(item: RawItem): ItemKind {
  if (item.divider === true) return 'divider';
  if (item.header !== undefined && item.header !== null) return 'header';
  return 'tappable';
}

export interface ItemsFieldProps {
  value: unknown;
  onChange: (next: unknown) => void;
  /** Parent node type — used so the nested ActionEditor reads the
   *  right `itemActionCapability` (NavigationDrawer / Menu / etc.). */
  parentNodeType: string | undefined;
}

export function ItemsField({ value, onChange, parentNodeType }: ItemsFieldProps) {
  const items = asItemArray(value);

  const updateItem = (index: number, patch: Partial<RawItem>): void => {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const replaceItem = (index: number, replacement: RawItem): void => {
    const next = items.slice();
    next[index] = replacement;
    onChange(next);
  };

  const removeItem = (index: number): void => {
    const next = items.slice();
    next.splice(index, 1);
    onChange(next);
  };

  const moveItem = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  };

  const changeKind = (index: number, kind: ItemKind): void => {
    // Reset to the canonical empty shape for the new kind so stale
    // fields (e.g. an old `action` on a node that just became a
    // divider) don't leak into the serialized JSON.
    if (kind === 'divider') replaceItem(index, { divider: true });
    else if (kind === 'header') replaceItem(index, { header: { en: 'Section' } });
    else replaceItem(index, { label: { en: 'Item' }, action: 'select' });
  };

  const addItem = (kind: ItemKind): void => {
    let next: RawItem;
    if (kind === 'divider') next = { divider: true };
    else if (kind === 'header') next = { header: { en: 'Section' } };
    else next = { label: { en: 'Item' }, action: 'select' };
    onChange([...items, next]);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-text">No items yet.</p>
      ) : (
        items.map((item, index) => {
          const kind = itemKind(item);
          return (
            <div
              key={index}
              className="rounded border border-primary-border bg-primary p-2"
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary-text">
                  Item {index + 1}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Move item up"
                    disabled={index === 0}
                    className="rounded p-0.5 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    onClick={() => moveItem(index, -1)}
                  >
                    <ChevronUp size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move item down"
                    disabled={index === items.length - 1}
                    className="rounded p-0.5 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    onClick={() => moveItem(index, 1)}
                  >
                    <ChevronDown size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove item"
                    className="rounded p-0.5 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-[10px] text-muted-text">
                  Kind
                  <Select
                    className="h-7 text-[11px]"
                    value={kind}
                    onChange={(e) => changeKind(index, e.target.value as ItemKind)}
                    aria-label="Item kind"
                  >
                    <option value="tappable">Tappable</option>
                    <option value="divider">Divider</option>
                    <option value="header">Section header</option>
                  </Select>
                </label>

                {kind === 'header' ? (
                  <label className="flex flex-col gap-0.5 text-[10px] text-muted-text">
                    Header
                    <MultiLangInput
                      value={item.header}
                      onChange={(v) => updateItem(index, { header: v })}
                      placeholder="Section title"
                    />
                  </label>
                ) : null}

                {kind === 'tappable' ? (
                  <>
                    <label className="flex flex-col gap-0.5 text-[10px] text-muted-text">
                      Label
                      <MultiLangInput
                        value={item.label}
                        onChange={(v) => updateItem(index, { label: v })}
                        placeholder="Item label"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] text-muted-text">
                      Icon
                      <Input
                        size="sm"
                        value={typeof item.icon === 'string' ? item.icon : ''}
                        onChange={(e) => updateItem(index, { icon: e.target.value || undefined })}
                        placeholder={MATERIAL_ICON_HINT}
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] text-muted-text">
                      Badge
                      <Input
                        size="sm"
                        value={typeof item.badge === 'string' ? item.badge : ''}
                        onChange={(e) => updateItem(index, { badge: e.target.value || undefined })}
                        placeholder="Optional badge text"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] text-muted-text">
                      Action
                      <ActionEditor
                        value={item.action}
                        onChange={(next) => updateItem(index, { action: next })}
                        nodeType={parentNodeType}
                        useItemCapability
                        command={typeof item.command === 'string' ? item.command : undefined}
                        validate={typeof item.validate === 'boolean' ? item.validate : undefined}
                        onSiblingChange={(siblingKey, siblingValue) =>
                          updateItem(index, { [siblingKey]: siblingValue })
                        }
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          );
        })
      )}

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => addItem('tappable')}
          className="flex items-center gap-1 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          <Plus size={11} /> Tappable item
        </button>
        <button
          type="button"
          onClick={() => addItem('divider')}
          className="flex items-center gap-1 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          <Plus size={11} /> Divider
        </button>
        <button
          type="button"
          onClick={() => addItem('header')}
          className="flex items-center gap-1 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          <Plus size={11} /> Section header
        </button>
      </div>
    </div>
  );
}
