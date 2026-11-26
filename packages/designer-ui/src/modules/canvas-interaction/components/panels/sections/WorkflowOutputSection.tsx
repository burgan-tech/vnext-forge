import { ArrowRightFromLine } from 'lucide-react';
import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { CsxEditorField, type ScriptCode } from '../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../modules/save-component/components/MappingScriptsSection';
import { WORKFLOW_LEVEL_STATE_KEY } from '../../../../../modules/code-editor/ScriptWorkflowSync';
import {
  outputMappingContent,
  type MappingBindingLike,
} from '../../../../../modules/save-component/declarative-mapping/declarativeMapping';
import {
  TaskBindingMappingField,
  useOpenWorkflowMasterSchemaRoot,
} from '../../../../../modules/save-component/declarative-mapping/TaskBindingMappingField';
import { MetadataSection } from './MetadataSection';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function WorkflowOutputSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const schemaRoot = useOpenWorkflowMasterSchemaRoot();
  if (!workflowJson) return null;

  const stored: unknown = (workflowJson as { attributes?: unknown }).attributes;
  const attrs: MappingBindingLike = isRecord(stored) ? stored : {};
  const content = outputMappingContent(attrs.output);
  // The script editor only sees a script-shaped output; a block is edited by the declarative editor.
  const output =
    content === 'script' || content === 'both' ? (attrs.output as ScriptCode) : undefined;

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

  const updateAttributes = (updater: (attributes: MappingBindingLike) => void) => {
    updateWorkflow((draft) => {
      const attributes: unknown = (draft as { attributes?: unknown }).attributes;
      if (isRecord(attributes)) updater(attributes);
    });
  };

  return (
    <MetadataSection
      title="Output"
      icon={<ArrowRightFromLine size={13} />}
      defaultOpen={content !== 'empty'}>
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Optional output for the workflow: shapes the sync response (data, status code, headers)
          with a declarative block or a C# script. Never applied to a sub-flow instance.
        </p>
        <TaskBindingMappingField
          binding={attrs}
          onUpdate={updateAttributes}
          owner="workflowOutput"
          schemaRoot={schemaRoot}
          renderScript={() => (
            <>
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
            </>
          )}
        />
      </div>
    </MetadataSection>
  );
}
