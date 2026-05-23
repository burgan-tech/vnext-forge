/**
 * View-level settings panel — the default content of the inspector when
 * nothing is selected, and a dedicated tab when the user wants to manage
 * the top-level view shape.
 *
 * Fields:
 *  - `dataSchema` — URN picker (from the host-supplied schema list) OR
 *    inline JSON object. The bind autocomplete in the inspector activates
 *    once a schema is bound.
 *  - `lookups` — list of `x-lookup` property names to activate on load.
 *  - `uiState` — initial values for the `$ui.*` namespace (raw JSON).
 *  - `$schema` — fixed to the pseudo-ui view vocabulary URL; surfaced
 *    read-only.
 */

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from 'zustand';

import { Input } from '../../../../ui/Input';
import { JsonCodeField } from '../../../../ui/JsonCodeField';
import { type BuilderStore } from './state/builderStore';

export interface ViewSettingsPanelProps {
  store: BuilderStore;
  /** Project schemas to pick from. The shell discovers and supplies these. */
  availableSchemas?: readonly { urn: string; label: string }[];
}

export function ViewSettingsPanel({ store, availableSchemas }: ViewSettingsPanelProps) {
  const definition = useStore(store, (s) => s.definition);
  const updateTopLevel = useStore(store, (s) => s.updateTopLevel);

  const dataSchemaMode: 'urn' | 'inline' =
    typeof definition.dataSchema === 'object' ? 'inline' : 'urn';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--vscode-panel-border)] p-3">
        <div className="text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
          View settings
        </div>
        <h3 className="text-[13px] font-semibold text-[var(--vscode-foreground)]">Settings</h3>
        <p className="mt-1 text-[11px] text-[var(--vscode-descriptionForeground)]">
          Select a node from the outline to edit its properties.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <Section title="Data schema" hint="Bind autocomplete in inputs uses this schema's properties.">
          <ModeTabs
            mode={dataSchemaMode}
            onChange={(mode) => {
              if (mode === 'urn') {
                updateTopLevel({ dataSchema: typeof definition.dataSchema === 'string' ? definition.dataSchema : '' });
              } else {
                updateTopLevel({ dataSchema: typeof definition.dataSchema === 'object' ? definition.dataSchema : {} });
              }
            }}
          />
          {dataSchemaMode === 'urn' ? (
            <SchemaPicker
              value={typeof definition.dataSchema === 'string' ? definition.dataSchema : ''}
              onChange={(next) => updateTopLevel({ dataSchema: next })}
              schemas={availableSchemas ?? []}
            />
          ) : (
            <JsonCodeField
              value={JSON.stringify(typeof definition.dataSchema === 'object' ? definition.dataSchema : {}, null, 2)}
              height={200}
              onChange={(next) => {
                const trimmed = next.trim();
                if (trimmed === '') {
                  updateTopLevel({ dataSchema: {} });
                  return;
                }
                try {
                  const parsed: unknown = JSON.parse(trimmed);
                  if (parsed && typeof parsed === 'object') {
                    updateTopLevel({ dataSchema: parsed as Record<string, unknown> });
                  }
                } catch {
                  // ignore — keep prior state until valid JSON
                }
              }}
              aria-label="Inline data schema"
            />
          )}
        </Section>

        <Section title="Lookups" hint="x-lookup property names to load on view mount.">
          <LookupsEditor
            value={definition.lookups ?? []}
            onChange={(next) => updateTopLevel({ lookups: next.length === 0 ? undefined : next })}
          />
        </Section>

        <Section title="UI state" hint='Initial values for the "$ui.*" namespace.'>
          <JsonCodeField
            value={JSON.stringify(definition.uiState ?? {}, null, 2)}
            height={140}
            onChange={(next) => {
              const trimmed = next.trim();
              if (trimmed === '') {
                updateTopLevel({ uiState: undefined });
                return;
              }
              try {
                const parsed: unknown = JSON.parse(trimmed);
                updateTopLevel({
                  uiState:
                    parsed && typeof parsed === 'object'
                      ? (parsed as Record<string, unknown>)
                      : undefined,
                });
              } catch {
                // ignore
              }
            }}
            aria-label="uiState JSON"
          />
        </Section>

        <Section title="$schema" hint="Pseudo-ui view vocabulary; not editable.">
          <Input value={definition.$schema} readOnly disabled />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--vscode-foreground)]">{title}</h4>
        {hint ? <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ModeTabs({ mode, onChange }: { mode: 'urn' | 'inline'; onChange: (mode: 'urn' | 'inline') => void }) {
  return (
    <div className="flex gap-1 text-[11px]">
      {(['urn', 'inline'] as const).map((m) => (
        <button
          key={m}
          type="button"
          className={[
            'rounded border px-2 py-0.5',
            m === mode
              ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
              : 'border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]',
          ].join(' ')}
          onClick={() => onChange(m)}
        >
          {m === 'urn' ? 'Pick existing schema' : 'Inline JSON'}
        </button>
      ))}
    </div>
  );
}

function SchemaPicker({
  value,
  onChange,
  schemas,
}: {
  value: string;
  onChange: (urn: string) => void;
  schemas: readonly { urn: string; label: string }[];
}) {
  const [query, setQuery] = useState(value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return schemas.slice(0, 12);
    return schemas.filter((s) => s.urn.toLowerCase().includes(q) || s.label.toLowerCase().includes(q)).slice(0, 12);
  }, [schemas, query]);

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="urn:..."
        aria-label="Data schema URN"
      />
      {schemas.length === 0 ? (
        <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          No project schemas discovered. Enter the URN manually.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">No matches.</p>
      ) : (
        <ul className="max-h-40 overflow-y-auto rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] text-[11px]">
          {filtered.map((s) => (
            <li
              key={s.urn}
              className={[
                'cursor-pointer px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground)]',
                value === s.urn ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' : '',
              ].join(' ')}
              onClick={() => {
                setQuery(s.urn);
                onChange(s.urn);
              }}
            >
              <div className="font-medium">{s.label}</div>
              <div className="truncate text-[10px] text-[var(--vscode-descriptionForeground)]">{s.urn}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LookupsEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {value.length === 0 ? (
        <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">No lookups defined.</p>
      ) : (
        value.map((lookup, i) => (
          <div key={i} className="flex items-center gap-1">
            <Input
              value={lookup}
              onChange={(e) => {
                const next = value.slice();
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder="property name (e.g. branchDetail)"
            />
            <button
              type="button"
              aria-label="Remove lookup"
              className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
              onClick={() => {
                const next = value.slice();
                next.splice(i, 1);
                onChange(next);
              }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        className="flex items-center gap-1 self-start rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
        onClick={() => onChange([...value, ''])}
      >
        <Plus size={11} /> Add lookup
      </button>
    </div>
  );
}
