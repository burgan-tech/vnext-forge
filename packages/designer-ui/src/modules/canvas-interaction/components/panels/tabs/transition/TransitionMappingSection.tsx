import { Trash2 } from 'lucide-react';
import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { Alert, AlertDescription, AlertTitle } from '../../../../../../ui/Alert';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import {
  hasDeclarativeBlocks,
  transitionBlockIssues,
  transitionTakesOutput,
  type MappingBindingLike,
  type TransitionBlocksLike,
} from '../../../../../../modules/save-component/declarative-mapping/declarativeMapping';
import {
  TaskBindingMappingField,
  useOpenWorkflowMasterSchemaRoot,
} from '../../../../../../modules/save-component/declarative-mapping/TaskBindingMappingField';
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
  /**
   * The transition itself, with `onUpdateTransition`: offers the declarative
   * `output` block beside the C# mapping (runtime vnext#1227). Omitted → the
   * C# mapping only.
   */
  transition?: TransitionBlocksLike;
  onUpdateTransition?: (updater: (transition: MappingBindingLike) => void) => void;
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
  transition,
  onUpdateTransition,
}: TransitionMappingSectionProps) {
  const schemaRoot = useOpenWorkflowMasterSchemaRoot();
  const renderScript = () => (
    <>
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
    </>
  );

  const declarative = Boolean(transition && onUpdateTransition);
  return (
    <Section
      title="Mapping"
      defaultOpen={!!mapping?.code || (declarative && hasDeclarativeBlocks(transition))}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        {declarative
          ? 'Writes the transition into instance data: a declarative output block or a C# mapping.'
          : 'Maps input and output between states for this transition.'}
      </p>
      {declarative && transition && onUpdateTransition ? (
        <TaskBindingMappingField
          binding={transition}
          onUpdate={onUpdateTransition}
          renderScript={renderScript}
          schemaRoot={schemaRoot}
          owner="transition"
          declarativeAllowed={transitionTakesOutput(transition.triggerType)}
          ownerIssues={transitionBlockIssues(transition)}
        />
      ) : (
        renderScript()
      )}
    </Section>
  );
}

/**
 * An automatic or scheduled transition carrying an `output` block: the runtime
 * rejects it at publish (an automatic hop has no request to map), so the block
 * is shown only to be removed.
 */
export function TransitionOutputNotAllowed({ onClear }: { onClear: () => void }) {
  return (
    <Alert variant="warning" className="py-2">
      <AlertTitle>A declarative output is not allowed here</AlertTitle>
      <AlertDescription>
        Automatic and scheduled transitions cannot declare an output block; the runtime rejects the
        workflow at publish.
      </AlertDescription>
      <button
        type="button"
        onClick={onClear}
        className="text-destructive-text hover:text-destructive-text/80 mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors">
        <Trash2 className="size-3.5 shrink-0" aria-hidden />
        Remove output
      </button>
    </Alert>
  );
}
