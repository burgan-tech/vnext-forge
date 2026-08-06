import type { ReactNode } from 'react';
import { ViewRenderer } from '@vnext-forge-studio/vnext-types';

import { PseudoUiLangPicker } from '../../quick-run/pseudo-ui/PseudoUiLangPicker';
import type { ViewResponse } from '../../quick-run/types/quickrun.types';

export interface FunctionRunViewSectionProps {
  /** Fixed section title — "Input view" / "Output view". Not the view's own key (see the meta strip below). */
  title: string;
  /** The adapted view, or `null` when nothing has loaded (yet, or ever). */
  view: ViewResponse | null;
  /** True while the view's contract is still being fetched. */
  loading?: boolean;
  /** Set when the contract declared a view but it could not be loaded. */
  error?: string | null;
  /** Shown when there is no view at all — not loading, no error, nothing declared. */
  emptyMessage: string;
  /** The rendered view surface (`PseudoUiOrJsonBlock`), shown only once `view` is non-null. */
  children?: ReactNode;
}

/**
 * Shared section chrome for the function runner's input/output pseudo-ui
 * surfaces — bordered section, header row, `border-t`, `p-3` body, mirroring
 * quick-run's `StateViewSection` pattern (`InstanceDashboard.tsx`) but in
 * this module's own semantic Tailwind tokens rather than `--vscode-*` (see
 * the plan's note on why the two aren't unified).
 *
 * Also owns the per-view meta strip quick-run's `StateViewContent` renders
 * just above the surface (view key, type badge, renderer badge, and
 * `PseudoUiLangPicker` pushed right via `ml-auto`) — extracted once here so
 * `FunctionRunInputPane` and `FunctionRunResponsePane` don't each carry their
 * own copy.
 */
export function FunctionRunViewSection({
  title,
  view,
  loading = false,
  error = null,
  emptyMessage,
  children,
}: FunctionRunViewSectionProps) {
  const isPseudoUi = view?.renderer === ViewRenderer.PseudoUi;

  return (
    <section className="border-border rounded border">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">{title}</p>
      </div>
      <div className="border-border border-t p-3">
        {view ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">{view.key}</span>
            <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[9px]">{view.type}</span>
            {view.renderer ? (
              <span className="border-border bg-muted text-muted-foreground rounded border px-1 py-0.5 text-[9px]">
                {view.renderer}
              </span>
            ) : null}
            {isPseudoUi ? <PseudoUiLangPicker className="ml-auto" /> : null}
          </div>
        ) : null}

        {loading ? (
          <p className="text-muted-foreground text-[10px]" aria-busy="true" aria-live="polite">
            Loading view…
          </p>
        ) : error ? (
          <p className="text-destructive-text text-[10px]" role="alert">
            {error}
          </p>
        ) : view ? (
          children
        ) : (
          <p className="text-muted-foreground text-[10px]">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}
