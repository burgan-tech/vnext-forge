/**
 * Editor for the State.interaction field (currently `interaction.longPoll`).
 *
 * Long polling tells the client workflow manager when to terminate an
 * open long-poll request for the state. See `LongPollConfig` /
 * `StateInteraction` in `@vnext-forge-studio/vnext-types` and the
 * `longPoll` definition in the workflow-definition schema.
 *
 * UI shape mirrors the other property-panel section editors:
 *   - Collapsible `Section` shell
 *   - An "Add long poll" / "Remove" toggle that adds or clears the
 *     `longPoll` block
 *   - When present: `terminate` (Yes/No), optional
 *     `fallbackTimeoutSeconds`, and a reused `RoleGrantEditor` for
 *     `roles`
 *
 * Fully controlled — `onChange(next | null)` fires for every mutation.
 * Parent (GeneralTab) decides how to write the draft and strips the
 * `interaction` field entirely when cleared so the saved JSON stays
 * minimal.
 */
import type { LongPollConfig, RoleGrant, StateInteraction } from '@vnext-forge-studio/vnext-types';
import {
  EditableInput,
  IconPlus,
  IconTrash,
  SelectField,
  Section,
} from '../PropertyPanelShared';
import { RoleGrantEditor } from '../subflow/RoleGrantEditor';

interface StateInteractionEditorProps {
  interaction: StateInteraction | null;
  onChange: (next: StateInteraction | null) => void;
}

const TERMINATE_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
] as const;

function makeEmptyLongPoll(): LongPollConfig {
  // Schema requires `terminate` and `roles`. Seed with one role row so
  // the user can type straight away.
  return { terminate: true, roles: [{ role: '', grant: 'allow' }] };
}

export function StateInteractionEditor({ interaction, onChange }: StateInteractionEditorProps) {
  const longPoll = interaction?.longPoll ?? null;

  const patchLongPoll = (patch: Partial<LongPollConfig>): void => {
    const base = longPoll ?? makeEmptyLongPoll();
    onChange({ longPoll: { ...base, ...patch } });
  };

  const addLongPoll = (): void => {
    onChange({ longPoll: makeEmptyLongPoll() });
  };

  const removeLongPoll = (): void => {
    // Clearing longPoll clears the whole interaction block — it's the
    // only member today.
    onChange(null);
  };

  const roles: RoleGrant[] = Array.isArray(longPoll?.roles) ? longPoll!.roles : [];

  return (
    <Section
      title="Interaction"
      count={longPoll ? 1 : 0}
      defaultOpen={!!longPoll}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Configure long polling so the client workflow manager knows when to
        terminate an open request for this state.
      </p>
      {!longPoll ? (
        <button
          type="button"
          onClick={addLongPoll}
          className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Add long poll
        </button>
      ) : (
        <div className="border border-border-subtle rounded-xl bg-surface p-2.5 space-y-2.5">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                Terminate
              </label>
              <SelectField
                value={longPoll.terminate ? 'true' : 'false'}
                onChange={(v) => patchLongPoll({ terminate: v === 'true' })}
                options={[...TERMINATE_OPTIONS]}
              />
            </div>
            <div className="w-28 shrink-0">
              <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                Fallback (s)
              </label>
              <EditableInput
                value={
                  longPoll.fallbackTimeoutSeconds === undefined
                    ? ''
                    : String(longPoll.fallbackTimeoutSeconds)
                }
                onChange={(v) => {
                  const n = Number(v);
                  patchLongPoll({
                    fallbackTimeoutSeconds:
                      v.trim() === '' || !Number.isFinite(n) ? undefined : n,
                  });
                }}
                mono
                placeholder="e.g. 30"
              />
            </div>
            <button
              type="button"
              onClick={removeLongPoll}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 mt-4 transition-all"
              aria-label="Remove long poll"
              title="Remove long poll">
              <IconTrash />
            </button>
          </div>

          <div>
            <label className="text-[9px] font-medium text-muted-foreground mb-1 block">
              Roles
            </label>
            <RoleGrantEditor
              roles={roles}
              onChange={(next) => patchLongPoll({ roles: next })}
              contextLabel="long poll"
            />
          </div>
        </div>
      )}
    </Section>
  );
}
