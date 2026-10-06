import { useState, type ReactNode } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../ui/Dialog';
import { CopyIdButton } from '../CopyIdButton';

export interface DetailsTab {
  id: string;
  label: string;
  /** Rendered only while the tab is selected — lazy data loads live inside. */
  render: () => ReactNode;
}

export interface DetailsBodyProps {
  tabs: DetailsTab[];
  initialTab?: string;
  /** Controlled selected tab id; pair with `onTabChange` to keep the tab across unmounts. */
  tab?: string;
  onTabChange?: (id: string) => void;
  /** 'panel' = docked-panel look (section-header strip, fills its parent); default is the dialog look. */
  variant?: 'dialog' | 'panel';
}

/**
 * Tabs + content of a details dialog. Kept apart from the Radix dialog so the
 * SSR test harness (which cannot portal) can render it.
 */
export function DetailsBody({ tabs, initialTab, tab, onTabChange, variant = 'dialog' }: DetailsBodyProps) {
  const panel = variant === 'panel';
  const [inner, setInner] = useState(initialTab ?? tabs[0]?.id);
  const selected = tab ?? inner;
  const setSelected = (id: string) => {
    setInner(id);
    onTabChange?.(id);
  };
  const current = tabs.find((t) => t.id === selected) ?? tabs[0];
  return (
    <div className={`flex min-h-0 flex-col ${panel ? 'h-full' : 'gap-2'}`}>
      {tabs.length > 1 && (
        <div
          className={`flex border-b border-[var(--vscode-panel-border)] ${
            panel ? 'shrink-0 bg-[var(--vscode-sideBarSectionHeader-background,transparent)]' : 'flex-wrap gap-1'
          }`}
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === current?.id}
              onClick={() => setSelected(tab.id)}
              className={`cursor-pointer border-b-2 text-[11px] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)] ${
                panel ? 'flex-1 px-2 py-1.5 font-medium' : '-mb-px px-2 py-1'
              } ${
                tab.id === current?.id
                  ? `${panel ? 'border-[var(--vscode-panelTitle-activeBorder,var(--vscode-focusBorder))]' : 'border-[var(--vscode-focusBorder)]'} text-[var(--vscode-foreground)]`
                  : 'border-transparent text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" className={`min-h-0 overflow-y-auto text-[11px] ${panel ? 'flex-1' : 'max-h-[60vh]'}`}>
        {current?.render()}
      </div>
    </div>
  );
}

export interface DetailsDialogProps extends DetailsBodyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
}

/** Tabbed details dialog shared by the History, Tasks and Correlations panels. */
export function DetailsDialog({ open, onOpenChange, title, description, tabs, initialTab }: DetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          {description && <DialogDescription className="text-[11px]">{description}</DialogDescription>}
        </DialogHeader>
        {open && <DetailsBody tabs={tabs} initialTab={initialTab} />}
      </DialogContent>
    </Dialog>
  );
}

/** Label / value rows for an Overview tab; `copy` adds a copy button for ids. */
export function DetailsList({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode; copy?: string; mono?: boolean } | null | false | undefined>;
}) {
  return (
    <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
      {rows.filter(Boolean).map((row) => {
        const r = row as { label: string; value: ReactNode; copy?: string; mono?: boolean };
        return (
          <div key={r.label} className="contents">
            <dt className="text-[var(--vscode-descriptionForeground)]">{r.label}</dt>
            <dd className={`flex min-w-0 items-start gap-1 break-all ${r.mono ? 'font-mono text-[10px]' : ''}`}>
              <span className="min-w-0">{r.value}</span>
              {r.copy ? <CopyIdButton value={r.copy} label={r.label} /> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
