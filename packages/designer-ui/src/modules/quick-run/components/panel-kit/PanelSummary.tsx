import type { ReactNode } from 'react';

export interface SummaryFilter<T extends string> {
  value: T;
  label: string;
}

/** Counts on the left, an optional segmented filter on the right. */
export function PanelSummary<T extends string>({
  children,
  filters,
  value,
  onChange,
}: {
  children: ReactNode;
  filters?: SummaryFilter<T>[];
  value?: T;
  onChange?: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-1.5 pb-1 text-[11px] text-[var(--vscode-descriptionForeground)]">
      <div className="min-w-0 flex-1">{children}</div>
      {filters && filters.length > 1 && (
        <div className="flex items-center gap-1" role="group" aria-label="Filter">
          {filters.map((f) => (
            <FilterChip key={f.value} selected={f.value === value} onClick={() => onChange?.(f.value)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`cursor-pointer rounded border px-2 py-0.5 text-[10px] font-medium ${
        selected
          ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
          : 'border-[var(--vscode-panel-border)] text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)]'
      }`}
    >
      {children}
    </button>
  );
}
