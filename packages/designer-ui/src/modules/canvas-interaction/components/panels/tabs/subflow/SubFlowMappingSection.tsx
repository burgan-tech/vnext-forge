import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { Section } from '../PropertyPanelShared';

interface SubFlowMappingSectionProps {
  mapping: ScriptCode | null | undefined;
  stateKey: string;
  onChange: (mapping: ScriptCode) => void;
  onRemove: () => void;
  /**
   * Optional `scripts` payload on the sub-flow mapping object. Wired
   * by the SubFlow tab; without it the helpers/assemblies editor is
   * suppressed.
   */
  scripts?: ScriptsConfig;
  onScriptsChange?: (next: ScriptsConfig | undefined) => void;
}

export function SubFlowMappingSection({
  mapping,
  stateKey,
  onChange,
  onRemove,
  scripts,
  onScriptsChange,
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
      {mapping && onScriptsChange && (
        <MappingScriptsSection value={scripts} onChange={onScriptsChange} />
      )}
    </Section>
  );
}
