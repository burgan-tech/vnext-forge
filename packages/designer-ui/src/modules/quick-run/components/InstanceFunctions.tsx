/**
 * "Functions" section of the Quick Runner instance dashboard.
 *
 * The State Function response declares `functions.hasFunctions` when the
 * running instance exposes callable functions; the catalog behind it is
 * fetched once per instance (see `InstanceDashboard`'s effect) and listed
 * here. Picking one and pressing Open hands off to the Function Quick
 * Runner already bound to this workflow + instance — the values a developer
 * would otherwise have to copy into its scope fields by hand.
 *
 * Placed directly under Available Transitions: both are "what can I do to
 * this instance right now", and a developer scanning transitions is in the
 * same frame of mind.
 *
 * Presentation-only, and prop-driven rather than store-reading. This
 * package's test harness is SSR-only (`renderToStaticMarkup`), where zustand
 * serves the snapshot frozen at store creation — a store-reading component
 * cannot be asserted on. `AvailableTransitions` is prop-driven for the same
 * reason.
 */

import type { FunctionCatalogEntry } from '../types/quickrun.types';

export interface InstanceFunctionsProps {
  /** `null` while the catalog has not been fetched yet. */
  entries: readonly FunctionCatalogEntry[] | null;
  loading: boolean;
  error: string | null;
  selected: string | null;
  onSelect: (name: string) => void;
  /**
   * Omitted by hosts that cannot navigate (designer-ui owns no router), in
   * which case the catalog is still listed but Open is not offered.
   */
  onOpen?: (entry: FunctionCatalogEntry) => void;
}

/** Native `<select>` styling used across quick-run (see `InstanceFilterPanel`). */
const SELECT_CLASS =
  'min-w-[12rem] flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-xs text-[var(--vscode-input-foreground)]';

export function InstanceFunctions({
  entries,
  loading,
  error,
  selected,
  onSelect,
  onOpen,
}: InstanceFunctionsProps) {
  const selectedEntry = entries?.find((e) => e.name === selected) ?? null;

  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase text-muted-text">Functions</p>

      {loading ? (
        <p className="text-[11px] text-muted-text">Loading functions…</p>
      ) : error ? (
        <p className="text-[11px] text-destructive-text">{error}</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-[11px] text-muted-text">No functions available on this instance</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={SELECT_CLASS}
            aria-label="Instance functions"
            value={selected ?? ''}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="">Select a function…</option>
            {entries.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.version ? `${entry.name} — v${entry.version}` : entry.name}
              </option>
            ))}
          </select>
          {onOpen ? (
            <button
              className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
              disabled={!selectedEntry}
              onClick={() => {
                if (selectedEntry) onOpen(selectedEntry);
              }}
              title="Open this function in the Function Quick Runner, bound to this instance"
            >
              Open
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
