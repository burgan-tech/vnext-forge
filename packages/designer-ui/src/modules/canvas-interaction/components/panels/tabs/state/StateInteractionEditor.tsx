/**
 * Editor for `state.interaction.longPoll`.
 *
 * Authorization is exactly one arm — role grants or a condition rule
 * (schema `oneOf`). "Authorize by" switches arms and clears the other one
 * (`switchLongPollArm`). Every write goes through `longPollConfig.ts`, so the
 * editor can never produce both arms.
 *
 * Fully controlled — `onChange(next | null)` fires for every mutation;
 * GeneralTab strips `interaction` when it is cleared.
 */
import type { MappingCode, StateInteraction } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import {
  EditableInput,
  IconPlus,
  IconTrash,
  SelectField,
  Section,
} from '../PropertyPanelShared';
import { RoleGrantEditor } from '../subflow/RoleGrantEditor';
import {
  EMPTY_RULE,
  currentLongPollArm,
  isRuleArm,
  longPollArmIssue,
  makeEmptyLongPoll,
  patchLongPoll as applyLongPollPatch,
  setLongPollRule,
  switchLongPollArm,
  type LongPollArm,
  type LongPollArmIssue,
  type LongPollPatch,
} from './longPollConfig';

interface StateInteractionEditorProps {
  interaction: StateInteraction | null;
  /** Owning state — addresses the rule script for the script panel. */
  stateKey: string;
  onChange: (next: StateInteraction | null) => void;
}

const TERMINATE_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
] as const;

const ARMS: readonly { value: LongPollArm; label: string }[] = [
  { value: 'roles', label: 'Roles' },
  { value: 'rule', label: 'Rule' },
];

const ARM_ISSUE_MESSAGES: Record<LongPollArmIssue, string> = {
  both: 'Both roles and a rule are set. The schema allows only one — pick the arm to keep.',
  neither: 'No authorization is set. Add role grants or create a rule script.',
};

export function StateInteractionEditor({ interaction, stateKey, onChange }: StateInteractionEditorProps) {
  const longPoll = interaction?.longPoll ?? null;

  const patchLongPoll = (patch: LongPollPatch): void => {
    onChange({ longPoll: applyLongPollPatch(longPoll, patch) });
  };

  const addLongPoll = (): void => {
    onChange({ longPoll: makeEmptyLongPoll() });
  };

  const removeLongPoll = (): void => {
    // Clearing longPoll clears the whole interaction block — it's the
    // only member today.
    onChange(null);
  };

  const arm: LongPollArm | null = longPoll ? currentLongPollArm(longPoll) : null;
  const issue = longPoll ? longPollArmIssue(longPoll) : null;
  const ruleArm = longPoll && isRuleArm(longPoll) ? longPoll : null;
  const roles = longPoll && !isRuleArm(longPoll) && Array.isArray(longPoll.roles) ? longPoll.roles : [];

  const selectArm = (next: LongPollArm): void => {
    if (!longPoll) return;
    if (arm === next && issue !== 'both') return;
    onChange({ longPoll: switchLongPollArm(longPoll, next) });
  };

  const writeRule = (rule: MappingCode): void => {
    if (!longPoll) return;
    onChange({ longPoll: setLongPollRule(longPoll, rule) });
  };

  return (
    <Section
      title="Interaction"
      count={longPoll ? 1 : 0}
      defaultOpen>
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
            <span className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
              Authorize by
            </span>
            <div
              role="group"
              aria-label="Authorize by"
              className="inline-flex rounded-lg border border-border bg-muted-surface p-0.5">
              {ARMS.map((option) => {
                const active = arm === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectArm(option.value)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-surface text-secondary-icon shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {issue && (
            <p
              role="alert"
              className="rounded-md border border-warning-border bg-warning-surface px-2 py-1 text-[10px] text-warning-text leading-relaxed">
              {ARM_ISSUE_MESSAGES[issue]}
            </p>
          )}

          {ruleArm ? (
            <div>
              <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                Rule
              </label>
              <p className="text-[10px] text-muted-foreground mb-1 leading-relaxed">
                Condition script (IConditionMapping) evaluated per caller. It reads
                context.Instance.Data; context.Body is not populated here. A false,
                throwing or non-compiling rule denies.
              </p>
              <CsxEditorField
                value={ruleArm.rule as ScriptCode}
                onChange={(sc) => writeRule(sc as MappingCode)}
                onRemove={() => writeRule({ ...EMPTY_RULE })}
                templateType="condition"
                contextName={`${stateKey}-longpoll-rule`}
                label="Long poll rule"
                stateKey={stateKey}
                listField="interaction"
                index={0}
                scriptField="longPoll.rule"
                allowRefEncoding
              />
              {ruleArm.rule.code ? (
                <MappingScriptsSection
                  value={ruleArm.rule.scripts}
                  onChange={(scripts) => writeRule({ ...ruleArm.rule, scripts })}
                />
              ) : null}
            </div>
          ) : (
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
          )}
        </div>
      )}
    </Section>
  );
}
