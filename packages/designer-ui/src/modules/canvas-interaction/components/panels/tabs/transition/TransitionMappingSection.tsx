import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { Section } from '../PropertyPanelShared';

interface TransitionMappingSectionProps {
  mapping: ScriptCode | null;
  stateKey: string;
  transitionKey: string;
  index: number;
  onChange: (mapping: ScriptCode) => void;
  onRemove: () => void;
  /**
   * Optional handlers for the `scripts` sub-object on this transition's
   * mapping. When omitted, the scripts section is suppressed (used by
   * code paths that aren't yet wired through).
   */
  scripts?: ScriptsConfig;
  onScriptsChange?: (next: ScriptsConfig | undefined) => void;
}

export function TransitionMappingSection({
  mapping,
  stateKey,
  transitionKey,
  index,
  onChange,
  onRemove,
  scripts,
  onScriptsChange,
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
      {mapping && onScriptsChange && (
        <MappingScriptsSection value={scripts} onChange={onScriptsChange} />
      )}
    </Section>
  );
}
