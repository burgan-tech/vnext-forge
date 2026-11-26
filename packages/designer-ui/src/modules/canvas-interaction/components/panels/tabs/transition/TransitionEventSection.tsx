import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import {
  hasDeclarativeBlocks,
  type MappingBindingLike,
} from '../../../../../../modules/save-component/declarative-mapping/declarativeMapping';
import { TaskBindingMappingField } from '../../../../../../modules/save-component/declarative-mapping/TaskBindingMappingField';
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
  /**
   * The transition's `event`, with `onUpdateEvent`: offers the declarative
   * `input` block beside the C# event mapping (runtime vnext#1227). Omitted →
   * the C# mapping only.
   */
  event?: MappingBindingLike;
  onUpdateEvent?: (updater: (event: MappingBindingLike) => void) => void;
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
  event,
  onUpdateEvent,
}: TransitionEventSectionProps) {
  const renderScript = () => (
    <>
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
    </>
  );

  return (
    <Section
      title="Event Mapping"
      defaultOpen={!!mapping?.code || (!!onUpdateEvent && hasDeclarativeBlocks(event))}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Maps the inbound external event payload to an instance key and body before it triggers this transition.
      </p>
      {onUpdateEvent ? (
        <TaskBindingMappingField
          binding={event ?? {}}
          onUpdate={onUpdateEvent}
          renderScript={renderScript}
          owner="event"
        />
      ) : (
        renderScript()
      )}
    </Section>
  );
}
