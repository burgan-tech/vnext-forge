import { Trash2 } from 'lucide-react';

import {
  TRANSITION_SCHEMA_NOT_MATCHED_CODE,
  hasTransitionSchemas,
} from '@vnext-forge-studio/vnext-types';

import { Alert, AlertDescription, AlertTitle } from '../../../../../../ui/Alert';
import { FunctionContractSlotField } from '../../../../../function-editor/components/FunctionContractSlotField';
import { Section } from '../PropertyPanelShared';

interface TransitionSchemasSectionProps {
  /** Raw `transition.schemas` value: entry array, `{ schemas: [...] }`, null or absent. */
  schemas: unknown;
  /** True when the transition also declares the single `schema`. */
  hasSingleSchema: boolean;
  /** Persist the canonical next value; `undefined` drops the key. */
  onChange: (next: unknown) => void;
  stateKey: string;
  transitionKey: string;
  transitionIndex: number;
}

/**
 * Rule-based transition `schemas` (vnext-schema 0.0.60 / runtime 0.0.105).
 *
 * Reuses the function contract's rule-entry editor in rule-only mode, so
 * entries, ordering, the fallback badge and the shadowing warning behave
 * exactly like a function's rule-based `inputSchema`. The single `schema`
 * keeps its own section; this list wins over it when both are declared.
 */
export function TransitionSchemasSection({
  schemas,
  hasSingleSchema,
  onChange,
  stateKey,
  transitionKey,
  transitionIndex,
}: TransitionSchemasSectionProps) {
  const declared = hasTransitionSchemas({ schemas });
  return (
    // Open whenever something is stored, including a shape the editor cannot read.
    <Section title="Rule-based schemas" defaultOpen={schemas != null}>
      {declared && hasSingleSchema ? (
        <Alert variant="info" className="mb-2 py-2">
          <AlertTitle>Schemas take precedence</AlertTitle>
          <AlertDescription>
            This transition also declares a single schema. The runtime uses this list and ignores
            the single schema; clear one of them to avoid confusion.
          </AlertDescription>
        </Alert>
      ) : null}
      <FunctionContractSlotField
        kind="schema"
        label="Schemas"
        hint={`Ordered entries; the first matching rule selects the payload schema and a rule-less entry is the fallback. If no entry matches, the transition is rejected (${TRANSITION_SCHEMA_NOT_MATCHED_CODE}).`}
        value={schemas}
        onChange={onChange}
        functionKey={transitionKey || stateKey}
        scriptListField="transitionSchemas"
        schemaRole="transition"
        ruleOnly
        ruleScriptAddress={(index) => ({
          stateKey,
          listField: 'transitions',
          index: transitionIndex,
          scriptField: `schemas[${index}].rule`,
        })}
      />
    </Section>
  );
}

/**
 * Shown when a transition that may not declare `schemas` (automatic or
 * scheduled) still carries one — e.g. after its trigger type changed.
 */
export function TransitionSchemasNotAllowed({ onClear }: { onClear: () => void }) {
  return (
    <Alert variant="warning" className="py-2">
      <AlertTitle>Rule-based schemas are not allowed here</AlertTitle>
      <AlertDescription>
        Automatic and scheduled transitions cannot declare schemas; the runtime rejects the workflow
        at publish.
      </AlertDescription>
      <button
        type="button"
        onClick={onClear}
        className="text-destructive-text hover:text-destructive-text/80 mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors">
        <Trash2 className="size-3.5 shrink-0" aria-hidden />
        Remove schemas
      </button>
    </Alert>
  );
}
