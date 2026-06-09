/**
 * Editor for the State.alias[] field.
 *
 * Each alias entry exposes the engine a friendlier / safer state name
 * (plus multi-language labels) for actors matching the alias's role
 * grants. The runtime picks the first alias whose roles resolve to
 * `allow` for the requesting actor; DENY overrides ALLOW per the
 * shared `RoleGrant` semantics. See `StateAlias` in
 * `@vnext-forge-studio/vnext-types`.
 *
 * UI shape mirrors the other property-panel section editors so users
 * recognise the controls:
 *   - Collapsible `Section` shell + `+ Add alias` button
 *   - Each alias card carries: name input, RoleGrantEditor reuse, an
 *     inline labels list (same row UI as TransitionLabelsSection but
 *     local copy to avoid coupling), and a trash button
 *
 * The component is fully controlled — `onChange(next)` is fired for
 * every mutation. Parent (GeneralTab) decides how to write to the
 * workflow draft and strips the field entirely when the array is
 * empty so the saved JSON stays minimal.
 */
import type { Label, RoleGrant, StateAlias } from '@vnext-forge-studio/vnext-types';
import {
  EditableInput,
  IconPlus,
  IconTrash,
  Section,
} from '../PropertyPanelShared';
import { RoleGrantEditor } from '../subflow/RoleGrantEditor';

interface StateAliasEditorProps {
  aliases: StateAlias[];
  onChange: (next: StateAlias[]) => void;
}

function makeEmptyAlias(): StateAlias {
  // Schema requires `roles` and `labels` to be non-empty (minItems: 1),
  // so seed with one role + one label row. Users can type into them
  // straight away without an extra click.
  return {
    name: '',
    roles: [{ role: '', grant: 'allow' }],
    labels: [{ language: 'tr', label: '' }],
  };
}

export function StateAliasEditor({ aliases, onChange }: StateAliasEditorProps) {
  const safe = Array.isArray(aliases) ? aliases : [];

  const patchAlias = (index: number, patch: Partial<StateAlias>): void => {
    const next = safe.map((a, i) => (i === index ? { ...a, ...patch } : a));
    onChange(next);
  };

  const addAlias = (): void => {
    onChange([...safe, makeEmptyAlias()]);
  };

  const removeAlias = (index: number): void => {
    onChange(safe.filter((_, i) => i !== index));
  };

  return (
    <Section
      title="Aliases"
      count={safe.length}
      defaultOpen={safe.length > 0}>
      {safe.length === 0 ? (
        <p className="text-muted-foreground py-2 text-center text-[11px]">
          No aliases. Define one to expose a role-scoped friendlier state name.
        </p>
      ) : (
        <div className="space-y-3">
          {safe.map((alias, i) => (
            <AliasCard
              key={i}
              alias={alias}
              onChange={(patch) => patchAlias(i, patch)}
              onRemove={() => removeAlias(i)}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={addAlias}
        className="text-secondary-icon hover:text-secondary-foreground mt-2 inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
        <IconPlus />
        Add alias
      </button>
    </Section>
  );
}

interface AliasCardProps {
  alias: StateAlias;
  onChange: (patch: Partial<StateAlias>) => void;
  onRemove: () => void;
}

function AliasCard({ alias, onChange, onRemove }: AliasCardProps) {
  const labels: Label[] = Array.isArray(alias.labels) ? alias.labels : [];
  const roles: RoleGrant[] = Array.isArray(alias.roles) ? alias.roles : [];

  const updateLabel = (index: number, field: keyof Label, value: string): void => {
    const next = labels.map((l, i) => (i === index ? { ...l, [field]: value } : l));
    onChange({ labels: next });
  };

  const addLabel = (): void => {
    onChange({ labels: [...labels, { language: 'en', label: '' }] });
  };

  const removeLabel = (index: number): void => {
    onChange({ labels: labels.filter((_, i) => i !== index) });
  };

  return (
    <div className="border border-border-subtle rounded-xl bg-surface p-2.5 space-y-2.5">
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
            Alias name
          </label>
          <EditableInput
            value={alias.name ?? ''}
            onChange={(v) => onChange({ name: v })}
            placeholder="e.g. Under Operational Review"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 mt-4 transition-all"
          aria-label={`Remove alias ${alias.name || 'entry'}`}
          title="Remove alias">
          <IconTrash />
        </button>
      </div>

      <div>
        <label className="text-[9px] font-medium text-muted-foreground mb-1 block">
          Roles
        </label>
        <RoleGrantEditor
          roles={roles}
          onChange={(next) => onChange({ roles: next })}
          contextLabel={alias.name || 'alias'}
        />
      </div>

      <div>
        <label className="text-[9px] font-medium text-muted-foreground mb-1 block">
          Labels
        </label>
        {labels.length === 0 ? (
          <p className="text-muted-foreground py-1 text-[11px]">
            No labels. Add one per language you support.
          </p>
        ) : (
          <div className="space-y-2">
            {labels.map((l, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="w-14 shrink-0">
                  <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                    Lang
                  </label>
                  <EditableInput
                    value={l.language ?? ''}
                    onChange={(v) => updateLabel(i, 'language', v)}
                    mono
                    placeholder="tr"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                    Display label
                  </label>
                  <EditableInput
                    value={l.label ?? ''}
                    onChange={(v) => updateLabel(i, 'label', v)}
                    placeholder="Display label"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLabel(i)}
                  className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 mt-4 transition-all"
                  aria-label={`Remove label ${l.language}`}>
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addLabel}
          className="text-secondary-icon hover:text-secondary-foreground mt-1 inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Add label
        </button>
      </div>
    </div>
  );
}
