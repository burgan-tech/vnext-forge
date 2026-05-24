/**
 * TabView `tabs[]` editor (R17).
 *
 * Vocabulary (`view-vocabulary.json` → tabViewComponent → `tabs[]`):
 *
 *   {
 *     title:   string | multiLangText  // required
 *     icon:    string                   // optional PrimeIcons name
 *     content: ComponentNode[]          // required, edited via outline / canvas
 *   }
 *
 * Mirrors `StepsField` shape — bordered cards per tab with reorder +
 * remove + an Add button. Title uses `MultiLangInput`; icon is an
 * optional free-text PrimeIcons name. The tab's `content` array is
 * edited through the outline tree and the canvas SDK drop targets so
 * the standard insertion / reorder flow stays consistent.
 */
import { MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react';

import { Input } from '../../../../../ui/Input';
import { MultiLangInput } from './MultiLangInput';

export interface TabValue {
  title?: unknown;
  icon?: string;
  content?: unknown[];
  [extra: string]: unknown;
}

export interface TabsFieldProps {
  value: unknown;
  onChange: (next: unknown) => void;
}

function asTabArray(value: unknown): TabValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is TabValue => typeof t === 'object' && t !== null);
}

export function TabsField({ value, onChange }: TabsFieldProps) {
  const tabs = asTabArray(value);

  const update = (next: TabValue[]): void => {
    onChange(next.length === 0 ? undefined : next);
  };

  const replaceAt = (index: number, patch: Partial<TabValue>): void => {
    const next = tabs.slice();
    next[index] = { ...next[index], ...patch };
    update(next);
  };

  const removeAt = (index: number): void => {
    const next = tabs.slice();
    next.splice(index, 1);
    update(next);
  };

  const moveUp = (index: number): void => {
    if (index <= 0) return;
    const next = tabs.slice();
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    update(next);
  };

  const moveDown = (index: number): void => {
    if (index >= tabs.length - 1) return;
    const next = tabs.slice();
    [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
    update(next);
  };

  const addTab = (): void => {
    update([...tabs, { title: { en: `Tab ${tabs.length + 1}` }, content: [] }]);
  };

  return (
    <div className="flex flex-col gap-2">
      {tabs.length === 0 ? (
        <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">No tabs defined.</p>
      ) : (
        tabs.map((tab, i) => {
          const contentCount = Array.isArray(tab.content) ? tab.content.length : 0;
          return (
            <div key={i} className="rounded border border-[var(--vscode-panel-border)] p-2">
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                  Tab {i + 1}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => moveUp(i)}
                    className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <MoveUp size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === tabs.length - 1}
                    onClick={() => moveDown(i)}
                    className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <MoveDown size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove tab"
                    onClick={() => removeAt(i)}
                    className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-errorForeground)]"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <MultiLangInput
                  value={tab.title}
                  onChange={(next) => replaceAt(i, { title: next as TabValue['title'] })}
                  placeholder="Tab title"
                />
                <Input
                  size="sm"
                  value={tab.icon ?? ''}
                  onChange={(e) => replaceAt(i, { icon: e.target.value || undefined })}
                  placeholder="icon (PrimeIcons, e.g. home, user, cog)"
                  aria-label="Tab icon (PrimeIcons name)"
                />
                <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                  Content: {contentCount} child{contentCount === 1 ? '' : 'ren'} · edit via outline / canvas
                </span>
              </div>
            </div>
          );
        })
      )}
      <button
        type="button"
        onClick={addTab}
        className="flex items-center gap-1 self-start rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
      >
        <Plus size={11} /> Add tab
      </button>
    </div>
  );
}
