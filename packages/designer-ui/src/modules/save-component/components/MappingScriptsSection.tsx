import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';

import type { ResourceReference, ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { ChooseExistingVnextComponentDialog } from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import { Input } from '../../../ui/Input';

interface MappingScriptsSectionProps {
  /**
   * Current `scripts` payload from the surrounding mapping / rule /
   * timer / workflow attributes. `undefined` is treated the same as
   * `{ helpers: [], allowedAssemblies: [] }`.
   */
  value: ScriptsConfig | undefined | null;
  /**
   * Persist a new `scripts` payload. Pass `undefined` to remove the
   * `scripts` field from the parent object entirely (the helper sends
   * that when both lists are empty).
   */
  onChange: (next: ScriptsConfig | undefined) => void;
  /** Visual label override. Defaults to "Helpers & assemblies". */
  label?: string;
  /**
   * If true, persistence stays a no-op when the section is collapsed
   * (used by container parents to hide the section behind a toggle
   * but still mount it for keyboard accessibility / form context).
   */
  disabled?: boolean;
}

const EMPTY: ScriptsConfig = { helpers: [], allowedAssemblies: [] };

function shapeEqual(a: ResourceReference, b: ResourceReference): boolean {
  return (
    a.key === b.key &&
    a.version === b.version &&
    (a.flow ?? '') === (b.flow ?? '') &&
    (a.domain ?? '') === (b.domain ?? '')
  );
}

/**
 * Inline editor for the `scripts` sub-object that decorates every
 * script-carrying shape (mapping / rule / timer / workflow attributes).
 * Helpers are always picked from `sys-mappings` components via
 * `ChooseExistingVnextComponentDialog`; assemblies are free-form .NET
 * assembly names entered as plain chips.
 *
 * Emits `undefined` when both lists are empty so the parent can omit
 * the `scripts` field entirely from the serialized JSON.
 */
export function MappingScriptsSection({
  value,
  onChange,
  label = 'Helpers & assemblies',
  disabled = false,
}: MappingScriptsSectionProps) {
  const scripts = useMemo<ScriptsConfig>(() => value ?? EMPTY, [value]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assemblyDraft, setAssemblyDraft] = useState('');
  const helpersCount = scripts.helpers.length;
  const assembliesCount = scripts.allowedAssemblies.length;
  const totalCount = helpersCount + assembliesCount;
  // Collapsed by default — the section is opt-in metadata that takes
  // a noticeable amount of vertical space. Auto-expand when the
  // mapping already has at least one helper or allowed assembly so
  // existing values are immediately discoverable.
  const [open, setOpen] = useState(totalCount > 0);

  const emit = useCallback(
    (next: ScriptsConfig) => {
      const helpersEmpty = next.helpers.length === 0;
      const assembliesEmpty = next.allowedAssemblies.length === 0;
      if (helpersEmpty && assembliesEmpty) {
        onChange(undefined);
        return;
      }
      onChange(next);
    },
    [onChange],
  );

  const handlePickHelper = useCallback(
    (component: { key: string; flow: string; version?: string; path?: string }) => {
      setPickerOpen(false);
      // sys-mappings is the only category we surface here. `version`
      // may be missing on legacy discoveries — fall back to "1.0.0"
      // since the runtime requires a concrete reference.
      const next: ResourceReference = {
        key: component.key,
        version: component.version ?? '1.0.0',
        flow: component.flow,
        // ChooseExistingVnextComponentDialog reads `path` but not
        // `domain`; we capture the project domain via the surrounding
        // mapping JSON instead. Empty string keeps shape stable.
        domain: '',
      };
      if (scripts.helpers.some((h) => shapeEqual(h, next))) return;
      emit({ ...scripts, helpers: [...scripts.helpers, next] });
    },
    [scripts, emit],
  );

  const handleRemoveHelper = useCallback(
    (index: number) => {
      const helpers = scripts.helpers.filter((_, i) => i !== index);
      emit({ ...scripts, helpers });
    },
    [scripts, emit],
  );

  const handleAddAssembly = useCallback(() => {
    const candidate = assemblyDraft.trim();
    if (!candidate) return;
    if (scripts.allowedAssemblies.includes(candidate)) {
      setAssemblyDraft('');
      return;
    }
    emit({
      ...scripts,
      allowedAssemblies: [...scripts.allowedAssemblies, candidate],
    });
    setAssemblyDraft('');
  }, [assemblyDraft, scripts, emit]);

  const handleRemoveAssembly = useCallback(
    (index: number) => {
      emit({
        ...scripts,
        allowedAssemblies: scripts.allowedAssemblies.filter((_, i) => i !== index),
      });
    },
    [scripts, emit],
  );

  if (disabled) return null;

  return (
    <div className="border-border-subtle bg-surface/40 mt-2 flex flex-col rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group hover:bg-muted-surface/60 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors"
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}>
        <ChevronRight
          size={12}
          className={`text-muted-foreground transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-secondary-text flex-1 text-[10px] font-semibold uppercase tracking-wide">
          {label}
        </span>
        {totalCount > 0 && (
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-[9px]">
            {totalCount}
          </span>
        )}
      </button>

      {!open ? null : (
      <div className="flex flex-col gap-2 px-2.5 pb-2 pt-1">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">Helpers (sys-mappings)</span>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-secondary-text hover:bg-secondary-muted flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors"
            aria-label="Add helper mapping">
            <Plus size={11} />
            <span>Add helper</span>
          </button>
        </div>
        {scripts.helpers.length === 0 ? (
          <div className="text-muted-foreground rounded border border-dashed border-border-subtle px-2 py-1 text-[10px]">
            No helpers selected.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {scripts.helpers.map((helper, i) => (
              <li
                key={`${helper.flow ?? 'sys-mappings'}-${helper.domain ?? ''}-${helper.key}-${helper.version}-${i}`}
                className="border-border-subtle bg-muted-surface flex items-center gap-2 rounded border px-2 py-1">
                <span className="flex-1 truncate font-mono text-[10px] text-foreground">
                  {(helper.domain ? `${helper.domain}/` : '') + helper.key}@{helper.version}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveHelper(i)}
                  className="text-muted-icon hover:bg-destructive-surface hover:text-destructive-text shrink-0 rounded-md p-0.5 transition-all"
                  aria-label={`Remove helper ${helper.key}`}>
                  <Trash2 size={10} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">Allowed assemblies</span>
        </div>
        <div className="flex items-center gap-1">
          <Input
            value={assemblyDraft}
            onChange={(e) => setAssemblyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddAssembly();
              }
            }}
            placeholder="e.g. Newtonsoft.Json"
            className="h-6 flex-1 text-[10px]"
          />
          <button
            type="button"
            onClick={handleAddAssembly}
            disabled={!assemblyDraft.trim()}
            className="text-secondary-text hover:bg-secondary-muted flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
            aria-label="Add assembly">
            <Plus size={11} />
            <span>Add</span>
          </button>
        </div>
        {scripts.allowedAssemblies.length === 0 ? null : (
          <ul className="flex flex-wrap gap-1 pt-1">
            {scripts.allowedAssemblies.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="border-border-subtle bg-muted-surface flex items-center gap-1 rounded border px-1.5 py-0.5">
                <span className="font-mono text-[10px] text-foreground">{name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAssembly(i)}
                  className="text-muted-icon hover:text-destructive-text shrink-0 rounded p-0.5"
                  aria-label={`Remove assembly ${name}`}>
                  <Trash2 size={9} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
      )}

      <ChooseExistingVnextComponentDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        category="mappings"
        onSelect={handlePickHelper}
        title="Choose a mapping helper"
      />
    </div>
  );
}
