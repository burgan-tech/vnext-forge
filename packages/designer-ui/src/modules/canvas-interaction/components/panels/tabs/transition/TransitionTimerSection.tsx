import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { Section } from '../PropertyPanelShared';

interface TransitionTimerSectionProps {
  timer: ScriptCode | null;
  stateKey: string;
  transitionKey: string;
  index: number;
  onUpdateScript: (script: ScriptCode) => void;
  onRemoveScript: () => void;
  /**
   * Optional `scripts` payload on the timer's mapping object plus a
   * setter. Wired by `TransitionCard` for scheduled-trigger
   * transitions.
   */
  scripts?: ScriptsConfig;
  onScriptsChange?: (next: ScriptsConfig | undefined) => void;
}

export function TransitionTimerSection({
  timer,
  stateKey,
  transitionKey,
  index,
  onUpdateScript,
  onRemoveScript,
  scripts,
  onScriptsChange,
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
      {timer && onScriptsChange && (
        <MappingScriptsSection value={scripts} onChange={onScriptsChange} />
      )}
    </Section>
  );
}
