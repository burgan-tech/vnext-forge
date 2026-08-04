import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { FunctionContractSlotField } from './FunctionContractSlotField';
import { FunctionVerbsPicker } from './FunctionVerbsPicker';
import type { SlotKind } from '../functionContractSlots';

/** Contract keys under `attributes`; drives the default-open state. */
const CONTRACT_FIELDS = [
  'verbs',
  'inputSchema',
  'outputSchema',
  'inputView',
  'outputView',
] as const;

interface FunctionContractSectionProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  onBeforeOpenModal?: () => void;
}

interface SlotDescriptor {
  field: 'inputSchema' | 'outputSchema' | 'inputView' | 'outputView';
  kind: SlotKind;
  label: string;
  hint: string;
  scriptListField: string;
}

const SLOTS: SlotDescriptor[] = [
  {
    field: 'inputSchema',
    kind: 'schema',
    label: 'Input Schema',
    hint: 'Contract for the request body. Enforced by the runtime.',
    scriptListField: 'functionInputSchema',
  },
  {
    field: 'outputSchema',
    kind: 'schema',
    label: 'Output Schema',
    hint: 'Contract for the response body. Declarative only — not enforced.',
    scriptListField: 'functionOutputSchema',
  },
  {
    field: 'inputView',
    kind: 'view',
    label: 'Input View',
    hint: "View the client renders to collect this function's input.",
    scriptListField: 'functionInputView',
  },
  {
    field: 'outputView',
    kind: 'view',
    label: 'Output View',
    hint: "View the client renders to present this function's output.",
    scriptListField: 'functionOutputView',
  },
];

/**
 * Writes one `attributes` key, dropping it entirely when the next value is
 * `undefined` so the document never carries empty contract objects.
 */
function setAttribute(
  onChange: FunctionContractSectionProps['onChange'],
  key: string,
  next: unknown,
) {
  onChange((draft) => {
    const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
    if (next === undefined) delete attrs[key];
    else attrs[key] = next;
    draft.attributes = attrs;
  });
}

/**
 * "Contract" card — `verbs` plus the four input/output view and schema slots.
 *
 * Always rendered: Forge offers the current contract regardless of which schema
 * release the open project pins. If that pin does not define these fields the
 * save still goes through — `save-component/versionSkewErrors` classifies the
 * resulting `additionalProperties` errors as version skew and the save gate
 * reports it once, at save time.
 */
export function FunctionContractSection({
  json,
  onChange,
  onBeforeOpenModal,
}: FunctionContractSectionProps) {
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;

  const hasValue = CONTRACT_FIELDS.some((field) => attrs[field] != null);
  const [open, setOpen] = useState(hasValue);

  const functionKey = typeof json.key === 'string' && json.key ? json.key : 'function';

  return (
    <Card variant="default" className="gap-3">
      <CardHeader className="border-border border-b">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="hover:bg-secondary/60 inline-flex size-5 shrink-0 items-center justify-center rounded"
            aria-label={open ? 'Collapse Contract section' : 'Expand Contract section'}>
            <ChevronRight
              className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden
            />
          </button>
          Contract
        </CardTitle>
        <CardDescription className="text-xs">
          Supported HTTP verbs and the input/output contracts clients use.
        </CardDescription>
      </CardHeader>
      {open ? (
        <CardContent className="px-4 sm:px-6">
          <div className="space-y-4">
            <FunctionVerbsPicker
              value={attrs.verbs}
              onChange={(next: FunctionVerb[] | undefined) => setAttribute(onChange, 'verbs', next)}
            />

            {SLOTS.map((slot) => (
              <FunctionContractSlotField
                key={slot.field}
                kind={slot.kind}
                label={slot.label}
                hint={slot.hint}
                value={attrs[slot.field]}
                onChange={(next) => setAttribute(onChange, slot.field, next)}
                functionKey={functionKey}
                scriptListField={slot.scriptListField}
                onBeforeOpenModal={onBeforeOpenModal}
              />
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
