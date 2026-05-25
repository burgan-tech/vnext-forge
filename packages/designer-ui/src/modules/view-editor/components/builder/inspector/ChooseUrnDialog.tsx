/**
 * Dialog picker for action URNs surfaced by the Forge URN catalog.
 *
 * Replaces the inline `<Select>` optgroup approach in `ActionEditor`
 * — once the workspace has more than a handful of workflows or
 * functions the flat dropdown is hard to scan and impossible to
 * search. The dialog groups entries by source (Workflow transitions
 * / Functions), runs a single search box across labels + URNs, and
 * shows the full URN underneath each row so authors can verify
 * what they're picking before committing.
 *
 * Custom URN entry is intentionally NOT inside this dialog — the
 * ActionEditor exposes a separate "Custom URN" checkbox so the
 * author flips into free-text mode without going through the
 * grouped list.
 */

import { useMemo, useState } from 'react';
import { Search, Workflow, Zap } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../../ui/Dialog';
import { Input } from '../../../../../ui/Input';
import type { DomainActionEntry, ForgeUrnCatalog } from '../services/forgeUrnCatalog';

export interface ChooseUrnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: ForgeUrnCatalog;
  /**
   * Fires when the user picks an entry. The dialog closes itself —
   * the caller doesn't need to flip `open` to false manually.
   */
  onSelect: (entry: DomainActionEntry) => void;
}

interface UrnGroup {
  key: 'workflow' | 'function';
  label: string;
  icon: typeof Workflow;
  entries: DomainActionEntry[];
}

export function ChooseUrnDialog({ open, onOpenChange, catalog, onSelect }: ChooseUrnDialogProps) {
  const [query, setQuery] = useState('');

  const groups = useMemo<UrnGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const filter = (entries: DomainActionEntry[]) =>
      !q
        ? entries
        : entries.filter(
            (e) =>
              e.label.toLowerCase().includes(q) ||
              e.urn.toLowerCase().includes(q) ||
              (e.description ?? '').toLowerCase().includes(q),
          );

    return [
      { key: 'workflow', label: 'Workflow Transitions', icon: Workflow, entries: filter(catalog.workflows) },
      { key: 'function', label: 'Functions', icon: Zap, entries: filter(catalog.functions) },
    ];
  }, [catalog, query]);

  const totalVisible = groups.reduce((sum, g) => sum + g.entries.length, 0);
  const totalAvailable = catalog.workflows.length + catalog.functions.length;

  const handlePick = (entry: DomainActionEntry) => {
    onSelect(entry);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reset query when the dialog closes so the next open starts fresh.
        if (!next) setQuery('');
        onOpenChange(next);
      }}
    >
      <DialogContent
        variant="secondary"
        className="border-border bg-surface text-foreground gap-0 p-0 shadow-sm"
        showCloseButton
        closeButtonHoverable
        hoverable={false}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground text-base font-semibold tracking-tight">
            Choose action URN
          </DialogTitle>
        </DialogHeader>

        <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
          Pick a workflow transition or BFF function from the current workspace. URN goes into{' '}
          <code className="rounded bg-primary-surface px-1 py-0.5 text-[10px]">Button.command</code> and the action verb
          is set to <code className="rounded bg-primary-surface px-1 py-0.5 text-[10px]">dispatch</code>.
        </DialogDescription>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4">
          <div className="relative shrink-0">
            <Search size={12} className="text-muted-text pointer-events-none absolute top-1/2 left-2 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Search by label or URN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              variant="muted"
              size="sm"
              className="w-full max-w-md pl-7"
              autoComplete="off"
              autoFocus
            />
          </div>

          {totalAvailable === 0 ? (
            <div className="text-muted-text rounded border border-primary-border bg-primary-surface/30 p-3 text-xs">
              No workflow transitions or function URNs found in the current workspace. Define them in your
              workflow components (
              <code className="rounded bg-primary px-1 py-0.5 text-[10px]">transitions[].key</code>) and function
              components (<code className="rounded bg-primary px-1 py-0.5 text-[10px]">attributes.key</code>) to
              populate the picker.
            </div>
          ) : totalVisible === 0 ? (
            <div className="text-muted-text rounded border border-primary-border bg-primary-surface/30 p-3 text-xs">
              No URN matches your search.
            </div>
          ) : (
            <div className="border-border-subtle bg-surface/30 min-h-0 max-h-[min(52vh,440px)] flex-1 space-y-1 overflow-y-auto rounded-md border p-0.5">
              {groups.map((group) => {
                if (group.entries.length === 0) return null;
                const Icon = group.icon;
                return (
                  <div
                    key={group.key}
                    className="border-border-subtle/80 overflow-hidden rounded-md border bg-background/40"
                  >
                    <div className="bg-muted/30 text-muted-foreground border-border-subtle/80 flex items-center gap-1 border-b px-2 py-1 text-[9px] font-medium tracking-wide uppercase">
                      <Icon size={10} />
                      {group.label}
                      <span className="text-muted-text/70 ml-1 normal-case">({group.entries.length})</span>
                    </div>
                    <ul className="divide-border-subtle/90 divide-y" role="listbox" aria-label={group.label}>
                      {group.entries.map((entry) => (
                        <li
                          key={entry.urn}
                          className="odd:bg-background/40 even:bg-muted/20"
                        >
                          <button
                            type="button"
                            onClick={() => handlePick(entry)}
                            className="hover:bg-[var(--vscode-list-hoverBackground)] focus:bg-[var(--vscode-list-activeSelectionBackground)] focus:text-[var(--vscode-list-activeSelectionForeground)] flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left text-xs focus:outline-none"
                          >
                            <span className="text-foreground font-medium">{entry.label}</span>
                            <span className="text-muted-text font-mono text-[10px] break-all">{entry.urn}</span>
                            {entry.description ? (
                              <span className="text-secondary-text text-[10px]">{entry.description}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
