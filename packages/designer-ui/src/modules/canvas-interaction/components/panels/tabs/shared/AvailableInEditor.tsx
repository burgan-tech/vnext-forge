import { useState } from 'react';
import {
  parseAvailableIn,
  serializeAvailableIn,
  type AvailableIn,
  type AvailableInEntry,
  type RoleGrant,
} from '@vnext-forge-studio/vnext-types';
import { IconChevron } from '../PropertyPanelShared';
import { RoleGrantEditor } from '../subflow/RoleGrantEditor';
import { AvailableInMultiSelect, type StateOption } from './AvailableInMultiSelect';

export interface AvailableInEditorProps {
  value: AvailableIn | undefined;
  /** Receives `undefined` when the list empties, so the caller drops the key. */
  onChange: (next: AvailableIn | undefined) => void;
  stateOptions: StateOption[];
}

/**
 * Editor for a transition's `availableIn`.
 *
 * States are picked through the existing multi-select; each picked state then
 * gets an expandable row where per-state role grants can be added. A state
 * with no grants is written back as a **bare string**, so a workflow that
 * never uses role scoping round-trips its JSON untouched — that collapsing
 * lives in `serializeAvailableIn`, which every mutation here funnels through.
 */
export function AvailableInEditor({ value, onChange, stateOptions }: AvailableInEditorProps) {
  const entries = parseAvailableIn(value);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const commit = (next: AvailableInEntry[]) => onChange(serializeAvailableIn(next));

  const setStates = (keys: string[]) => {
    // Preserve the roles already attached to a state that stays selected, and
    // keep the user's picking order rather than the previous entry order.
    const byState = new Map(entries.map((e) => [e.state, e]));
    commit(keys.map((key) => byState.get(key) ?? { state: key }));
  };

  const setRoles = (state: string, roles: RoleGrant[]) => {
    commit(entries.map((e) => (e.state === state ? { ...e, roles } : e)));
  };

  const toggleExpanded = (state: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Limit this transition to specific states. Leave empty to apply everywhere.
        Roles added to a state are combined with the transition&apos;s own roles — a
        caller must satisfy both.
      </p>

      <AvailableInMultiSelect
        value={entries.map((e) => e.state)}
        onChange={setStates}
        stateOptions={stateOptions}
        showChips={false}
      />

      {entries.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {entries.map((entry) => {
            const roles = entry.roles ?? [];
            const isOpen = expanded.has(entry.state);
            const stateLabel = stateOptions.find((s) => s.key === entry.state)?.label;
            return (
              <div key={entry.state} className="rounded-lg bg-muted-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpanded(entry.state)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-muted cursor-pointer">
                  <span className="shrink-0 text-muted-foreground">
                    <IconChevron open={isOpen} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                    {entry.state}
                  </span>
                  {stateLabel && (
                    <span className="shrink-0 truncate text-[10px] text-muted-foreground max-w-[35%]">
                      {stateLabel}
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] text-muted-foreground font-mono tabular-nums">
                    {roles.length > 0
                      ? `${roles.length} role${roles.length > 1 ? 's' : ''}`
                      : 'all roles'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-2 pb-2 pt-0.5">
                    <RoleGrantEditor
                      roles={roles}
                      onChange={(next) => setRoles(entry.state, next)}
                      contextLabel={`state ${entry.state}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
