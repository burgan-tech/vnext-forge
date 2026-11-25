import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import {
  subFlowBlockIssues,
  type MappingBindingLike,
} from '../../../../../../modules/save-component/declarative-mapping/declarativeMapping';
import {
  TaskBindingMappingField,
  useOpenWorkflowMasterSchemaRoot,
} from '../../../../../../modules/save-component/declarative-mapping/TaskBindingMappingField';
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
  /**
   * The state's `subFlow` with `onUpdateSubFlow`: offers declarative `input` /
   * `output` blocks beside the C# mapping (runtime vnext#1227) — for a `type: S`
   * SubFlow only. Omitted → the C# mapping only.
   */
  subFlow?: MappingBindingLike & { type?: unknown };
  onUpdateSubFlow?: (updater: (subFlow: MappingBindingLike) => void) => void;
}

export function SubFlowMappingSection({
  mapping,
  stateKey,
  onChange,
  onRemove,
  scripts,
  onScriptsChange,
  subFlow,
  onUpdateSubFlow,
}: SubFlowMappingSectionProps) {
  const schemaRoot = useOpenWorkflowMasterSchemaRoot();
  const renderScript = () => (
    <>
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
    </>
  );

  return (
    <Section title="Mapping" defaultOpen>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Map inputs and outputs between this state and the child workflow.
      </p>
      {subFlow && onUpdateSubFlow ? (
        <TaskBindingMappingField
          binding={subFlow}
          onUpdate={onUpdateSubFlow}
          renderScript={renderScript}
          schemaRoot={schemaRoot}
          owner="subFlow"
          declarativeAllowed={subFlow.type === 'S'}
          ownerIssues={subFlowBlockIssues(subFlow)}
        />
      ) : (
        renderScript()
      )}
    </Section>
  );
}
