import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { Section } from '../PropertyPanelShared';

interface TransitionMappingSectionProps {
  mapping: ScriptCode | null;
  stateKey: string;
  transitionKey: string;
  index: number;
  onChange: (mapping: ScriptCode) => void;
  onRemove: () => void;
}

export function TransitionMappingSection({
  mapping,
  stateKey,
  transitionKey,
  index,
  onChange,
  onRemove,
}: TransitionMappingSectionProps) {
  return (
    <Section title="Mapping" defaultOpen={!!mapping?.code}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Maps input and output between states for this transition.
      </p>
      <CsxEditorField
        value={mapping}
        onChange={onChange}
        onRemove={onRemove}
        templateType="mapping"
        contextName={`${stateKey}-${transitionKey || 'mapping'}`}
        label="Mapping"
        stateKey={stateKey}
        listField="transitions"
        index={index}
        scriptField="mapping"
      />
    </Section>
  );
}
