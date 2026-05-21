import { type JsonPointer } from '../../../model/jsonPointer';
import { NumberFieldInput } from './NumberFieldInput';

interface NumberConstraintsProps {
  pointer: JsonPointer;
  integerOnly?: boolean;
}

/**
 * Constraint editors that apply to `type: "number"` / `"integer"`:
 * minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf.
 *
 * Draft 2020-12 form of `exclusiveMinimum`/`exclusiveMaximum` (numbers,
 * not booleans) is the only one supported — older boolean form will
 * round-trip through the raw passthrough fallback if present.
 */
export function NumberConstraints({ pointer, integerOnly = false }: NumberConstraintsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberFieldInput
        pointer={pointer}
        keyword="minimum"
        label="minimum"
        hint="Inclusive lower bound."
        integerOnly={integerOnly}
      />
      <NumberFieldInput
        pointer={pointer}
        keyword="maximum"
        label="maximum"
        hint="Inclusive upper bound."
        integerOnly={integerOnly}
      />
      <NumberFieldInput
        pointer={pointer}
        keyword="exclusiveMinimum"
        label="exclusiveMinimum"
        hint="Strict lower bound (instance must be greater)."
        integerOnly={integerOnly}
      />
      <NumberFieldInput
        pointer={pointer}
        keyword="exclusiveMaximum"
        label="exclusiveMaximum"
        hint="Strict upper bound (instance must be less)."
        integerOnly={integerOnly}
      />
      <NumberFieldInput
        pointer={pointer}
        keyword="multipleOf"
        label="multipleOf"
        hint="Instance must be a multiple of this value."
        min={0}
        className="sm:col-span-2"
      />
    </div>
  );
}
