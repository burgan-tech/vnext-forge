import type { MonitorTarget } from '../types';

/** `root › child › grandchild`; earlier levels are buttons that pop back. */
export function Breadcrumb({ levels, onPopTo }: { levels: readonly MonitorTarget[]; onPopTo: (index: number) => void }) {
  if (levels.length <= 1) return null;
  return (
    <nav aria-label="Instance levels" className="flex min-w-0 items-center gap-1 truncate text-[11px]">
      {levels.map((l, i) => (
        <span key={`${l.instanceId}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="opacity-60">›</span>}
          {i < levels.length - 1 ? (
            <button type="button" onClick={() => onPopTo(i)} className="cursor-pointer underline-offset-2 hover:underline">{l.workflowKey}</button>
          ) : (
            <span className="font-semibold" aria-current="page">{l.workflowKey}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
