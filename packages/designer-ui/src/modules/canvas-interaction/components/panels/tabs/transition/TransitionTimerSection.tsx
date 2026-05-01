import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { Section } from '../PropertyPanelShared';

interface TransitionTimerSectionProps {
  timer: ScriptCode | null;
  stateKey: string;
  transitionKey: string;
  index: number;
  onUpdateScript: (script: ScriptCode) => void;
  onRemoveScript: () => void;
}

export function TransitionTimerSection({
  timer,
  stateKey,
  transitionKey,
  index,
  onUpdateScript,
  onRemoveScript,
}: TransitionTimerSectionProps) {
  return (
    <Section title="Timer" defaultOpen={!!timer?.code}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Schedule expression or script for when this transition fires.
      </p>
      <CsxEditorField
        value={timer}
        onChange={onUpdateScript}
        onRemove={onRemoveScript}
        templateType="timer"
        contextName={`${stateKey}-${transitionKey || 'timer'}`}
        label="Timer"
        stateKey={stateKey}
        listField="transitions"
        index={index}
        scriptField="timer"
      />
    </Section>
  );
}
