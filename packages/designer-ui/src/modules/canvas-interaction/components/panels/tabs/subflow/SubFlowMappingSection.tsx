import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { Section } from '../PropertyPanelShared';

interface SubFlowMappingSectionProps {
  mapping: ScriptCode | null | undefined;
  stateKey: string;
  onChange: (mapping: ScriptCode) => void;
  onRemove: () => void;
}

export function SubFlowMappingSection({
  mapping,
  stateKey,
  onChange,
  onRemove,
}: SubFlowMappingSectionProps) {
  return (
    <Section title="Mapping" defaultOpen>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Map inputs and outputs between this state and the child workflow.
      </p>
      <CsxEditorField
        value={mapping}
        onChange={onChange}
        onRemove={onRemove}
        templateType="mapping"
        contextName={`${stateKey}-subflow`}
        label="Mapping"
        stateKey={stateKey}
        listField="subFlow"
        index={0}
        scriptField="mapping"
      />
    </Section>
  );
}
