import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { Section } from '../PropertyPanelShared';

interface TransitionEventSectionProps {
  mapping: ScriptCode | null;
  stateKey: string;
  transitionKey: string;
  index: number;
  onChange: (mapping: ScriptCode) => void;
  onRemove: () => void;
  /**
   * Optional handlers for the `scripts` sub-object on this transition's
   * event mapping. When omitted, the scripts section is suppressed (used
   * by code paths that aren't yet wired through).
   */
  scripts?: ScriptsConfig;
  onScriptsChange?: (next: ScriptsConfig | undefined) => void;
}

export function TransitionEventSection({
  mapping,
  stateKey,
  transitionKey,
  index,
  onChange,
  onRemove,
  scripts,
  onScriptsChange,
}: TransitionEventSectionProps) {
  return (
    <Section title="Event Mapping" defaultOpen={!!mapping?.code}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Maps the inbound external event payload to an instance key and body before it triggers this transition.
      </p>
      <CsxEditorField
        value={mapping}
        onChange={onChange}
        onRemove={onRemove}
        templateType="mapping"
        contextName={`${stateKey}-${transitionKey || 'event'}-mapping`}
        label="Event Mapping"
        stateKey={stateKey}
        listField="transitions"
        index={index}
        scriptField="event.mapping"
      />
      {mapping && onScriptsChange && (
        <MappingScriptsSection value={scripts} onChange={onScriptsChange} />
      )}
    </Section>
  );
}
