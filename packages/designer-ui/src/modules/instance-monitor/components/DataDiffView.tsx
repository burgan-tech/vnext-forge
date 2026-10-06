import { ChevronRight } from 'lucide-react';

import type { JsonDiff } from '../model/jsonDiff';

const ADDED = 'var(--vscode-gitDecoration-addedResourceForeground, #81b88b)';
const REMOVED = 'var(--vscode-gitDecoration-deletedResourceForeground, #c74e39)';
const CHANGED = 'var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)';
const BORDER = 'var(--vscode-panel-border, #3c3c3c)';

const plural = (n: number) => `${n} field${n === 1 ? '' : 's'}`;

function Badge({ symbol, color }: { symbol: string; color: string }) {
  return (
    <span className="mt-0.5 rounded px-1 font-mono text-[10px] font-bold" style={{ color, border: `1px solid ${color}` }}>
      {symbol}
    </span>
  );
}

/** Read-only field-level diff (added / removed / changed). */
export function DataDiffView({ diff }: { diff: JsonDiff }) {
  const hasChanges = diff.added.length + diff.removed.length + diff.changed.length > 0;
  if (!hasChanges) {
    return (
      <p className="rounded border p-3 text-center text-[11px] text-[var(--vscode-descriptionForeground,#9d9d9d)]" style={{ borderColor: BORDER }}>
        No differences. {plural(diff.unchangedCount)} unchanged.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {diff.added.map((f) => (
        <div key={`add-${f.path}`} className="flex items-start gap-2 rounded border px-2 py-1" style={{ borderColor: ADDED }}>
          <Badge symbol="+" color={ADDED} />
          <span className="break-all font-mono">{f.path}</span>
          <span className="ml-auto break-all font-mono text-[var(--vscode-descriptionForeground,#9d9d9d)]">{f.value}</span>
        </div>
      ))}
      {diff.removed.map((f) => (
        <div key={`rem-${f.path}`} className="flex items-start gap-2 rounded border px-2 py-1" style={{ borderColor: REMOVED }}>
          <Badge symbol="−" color={REMOVED} />
          <span className="break-all font-mono">{f.path}</span>
          <span className="ml-auto break-all font-mono text-[var(--vscode-descriptionForeground,#9d9d9d)]">{f.value}</span>
        </div>
      ))}
      {diff.changed.map((f) => (
        <div key={`chg-${f.path}`} className="rounded border px-2 py-1" style={{ borderColor: CHANGED }}>
          <div className="flex items-center gap-2">
            <Badge symbol="~" color={CHANGED} />
            <span className="break-all font-mono">{f.path}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 pl-6 font-mono">
            <span className="break-all line-through" style={{ color: REMOVED }}>{f.oldValue}</span>
            <ChevronRight size={12} aria-hidden />
            <span className="break-all" style={{ color: ADDED }}>{f.newValue}</span>
          </div>
        </div>
      ))}
      <p className="text-right text-[10px] text-[var(--vscode-descriptionForeground,#9d9d9d)]">{plural(diff.unchangedCount)} unchanged</p>
    </div>
  );
}
