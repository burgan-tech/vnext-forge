import { Zap } from 'lucide-react';
import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { CsxEditorField, type ScriptCode } from '../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../modules/save-component/components/MappingScriptsSection';
import { WORKFLOW_LEVEL_STATE_KEY } from '../../../../../modules/code-editor/ScriptWorkflowSync';
import { MetadataSection } from './MetadataSection';

export function WorkflowEventSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const eventMapping = attrs.event?.mapping as ScriptCode | undefined;

  const updateEventMapping = (next: ScriptCode) => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes.event) draft.attributes.event = {};
      draft.attributes.event.mapping = next;
    });
  };

  const removeEventMapping = () => {
    updateWorkflow((draft: any) => {
      delete draft.attributes.event;
    });
  };

  const updateEventMappingScripts = (next: ScriptsConfig | undefined) => {
    updateWorkflow((draft: any) => {
      const m = draft.attributes?.event?.mapping;
      if (!m) return;
      if (next === undefined) {
        delete m.scripts;
      } else {
        m.scripts = next;
      }
    });
  };

  return (
    <MetadataSection
      title="Event"
      icon={<Zap size={13} />}
      defaultOpen={!!eventMapping}>
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          External event that starts a new instance of this workflow (action=start).
        </p>
        <CsxEditorField
          value={eventMapping ?? null}
          onChange={updateEventMapping}
          onRemove={removeEventMapping}
          templateType="mapping"
          contextName="workflow-event"
          label="Event Mapping"
          stateKey={WORKFLOW_LEVEL_STATE_KEY}
          listField="event"
          index={0}
          scriptField="mapping"
        />
        {eventMapping && (
          <MappingScriptsSection
            value={(eventMapping as { scripts?: ScriptsConfig }).scripts}
            onChange={updateEventMappingScripts}
          />
        )}
      </div>
    </MetadataSection>
  );
}
