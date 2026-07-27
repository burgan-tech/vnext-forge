import { ArrowRightFromLine } from 'lucide-react';
import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { CsxEditorField, type ScriptCode } from '../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../modules/save-component/components/MappingScriptsSection';
import { WORKFLOW_LEVEL_STATE_KEY } from '../../../../../modules/code-editor/ScriptWorkflowSync';
import { MetadataSection } from './MetadataSection';

export function WorkflowOutputSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const output = attrs.output as ScriptCode | undefined;

  const updateOutput = (next: ScriptCode) => {
    updateWorkflow((draft: any) => {
      draft.attributes.output = next;
    });
  };

  const removeOutput = () => {
    updateWorkflow((draft: any) => {
      delete draft.attributes.output;
    });
  };

  const updateOutputScripts = (next: ScriptsConfig | undefined) => {
    updateWorkflow((draft: any) => {
      const o = draft.attributes?.output;
      if (!o) return;
      if (next === undefined) {
        delete o.scripts;
      } else {
        o.scripts = next;
      }
    });
  };

  return (
    <MetadataSection
      title="Output"
      icon={<ArrowRightFromLine size={13} />}
      defaultOpen={!!output}>
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Optional output mapping for the workflow. Shapes the data returned
          when the workflow completes.
        </p>
        <CsxEditorField
          value={output ?? null}
          onChange={updateOutput}
          onRemove={removeOutput}
          templateType="mapping"
          contextName="workflow-output"
          label="Output Mapping"
          stateKey={WORKFLOW_LEVEL_STATE_KEY}
          listField="attributes"
          index={0}
          scriptField="output"
        />
        {output && (
          <MappingScriptsSection
            value={(output as { scripts?: ScriptsConfig }).scripts}
            onChange={updateOutputScripts}
          />
        )}
      </div>
    </MetadataSection>
  );
}
