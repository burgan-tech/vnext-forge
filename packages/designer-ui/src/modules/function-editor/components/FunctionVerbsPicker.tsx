import { FUNCTION_VERBS, type FunctionVerb } from '@vnext-forge-studio/vnext-types';

import { Checkbox } from '../../../ui/Checkbox';
import { Field } from '../../../ui/Field';
import { readVerbs, toggleVerb } from '../functionContractSlots';

/**
 * Descriptions come straight from the contract's `enumDescriptions`, so
 * the UI explains each verb the same way the schema does.
 */
const VERB_DESCRIPTIONS: Record<FunctionVerb, string> = {
  GET: 'Read without a request body',
  POST: 'Create or invoke with a request body',
  PATCH: 'Partial update with a request body',
  DELETE: 'Delete',
};

interface FunctionVerbsPickerProps {
  /** Raw `attributes.verbs`; anything unparseable reads as no selection. */
  value: unknown;
  /** Receives the canonical next value, or `undefined` to drop the key. */
  onChange: (next: FunctionVerb[] | undefined) => void;
}

/**
 * Multi-select for `attributes.verbs`. Four fixed options, so a grid of
 * checkbox cards beats a searchable popover — it mirrors the layout of
 * `FunctionScopePicker` one row wider.
 *
 * An empty selection removes the key entirely rather than writing `[]`:
 * the contract sets `minItems: 1`, and an absent `verbs` means "no verb
 * restriction".
 */
export function FunctionVerbsPicker({ value, onChange }: FunctionVerbsPickerProps) {
  const selected = readVerbs(value);

  return (
    <Field
      label="Verbs"
      hint={
        selected.length === 0
          ? 'No verb restriction — the function accepts any verb the runtime allows.'
          : 'HTTP verbs this function supports.'
      }
      className="space-y-0">
      <div
        className="grid grid-cols-4 gap-1.5"
        role="group"
        aria-label="Supported HTTP verbs">
        {FUNCTION_VERBS.map((verb) => {
          const checked = selected.includes(verb);
          return (
            <label
              key={verb}
              className={`flex cursor-pointer items-start gap-1.5 rounded-lg border px-2 py-1 transition-all ${
                checked
                  ? 'border-primary-border bg-primary-muted/60'
                  : 'border-border bg-surface hover:border-muted-border-hover'
              }`}>
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => onChange(toggleVerb(selected, verb, next === true))}
                aria-label={`${verb} — ${VERB_DESCRIPTIONS[verb]}`}
                className="mt-0.5 shrink-0"
              />
              <span className="min-w-0">
                <span className="text-foreground block font-mono text-xs font-semibold">{verb}</span>
                <span className="text-muted-foreground block text-[10px] leading-tight">
                  {VERB_DESCRIPTIONS[verb]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}
