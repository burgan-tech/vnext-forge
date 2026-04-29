import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { Section, SelectField } from '../PropertyPanelShared';
import { TriggerKind } from '@vnext-forge/vnext-types';

interface TransitionConditionSectionProps {
  rule: ScriptCode | null;
  triggerKind: number | undefined;
  stateKey: string;
  transitionKey: string;
  index: number;
  onUpdateScript: (script: ScriptCode) => void;
  onRemoveScript: () => void;
  onUpdateTriggerKind: (value: number | undefined) => void;
}

const TRIGGER_KIND_OPTIONS = [
  { value: String(TriggerKind.Standard), label: 'Standard' },
  { value: String(TriggerKind.DefaultAuto), label: 'Default / Fallback' },
];

export function TransitionConditionSection({
  rule,
  triggerKind,
  stateKey,
  transitionKey,
  index,
  onUpdateScript,
  onRemoveScript,
  onUpdateTriggerKind,
}: TransitionConditionSectionProps) {
  return (
    <Section title="Condition" defaultOpen={!!rule?.code}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Runs when this transition is evaluated automatically.
      </p>

      <div className="mb-2">
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
          Default transition
        </label>
        <SelectField
          value={String(triggerKind ?? TriggerKind.Standard)}
          onChange={(v) => {
            const num = Number(v);
            onUpdateTriggerKind(num === TriggerKind.Standard ? undefined : num);
          }}
          options={TRIGGER_KIND_OPTIONS}
        />
        <p className="text-[9px] text-subtle mt-0.5 leading-relaxed">
          Use when multiple automatic transitions compete; only one should be default.
        </p>
      </div>

      <CsxEditorField
        value={rule}
        onChange={onUpdateScript}
        onRemove={onRemoveScript}
        templateType="condition"
        contextName={`${stateKey}-${transitionKey || 'rule'}`}
        label="Condition"
        stateKey={stateKey}
        listField="transitions"
        index={index}
        scriptField="rule"
      />
    </Section>
  );
}
