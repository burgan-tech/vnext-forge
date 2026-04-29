import { Field } from '../../../../ui/Field';
import { Input } from '../../../../ui/Input';
import { Select } from '../../../../ui/Select';

interface TransitionNameFieldProps {
  value: string;
  onChange: (updater: (draft: any) => void) => void;
  /** Transition keys discovered from a local workflow file. Empty when no workflow is selected. */
  availableTransitions: string[];
}

/**
 * Transition name field with an optional quick-pick Select dropdown.
 * When transitions are available from a selected local workflow, a Select
 * is shown above the free-text input for quick selection.
 * Free-text entry always remains available.
 */
export function TransitionNameField({ value, onChange, availableTransitions }: TransitionNameFieldProps) {
  const hasOptions = availableTransitions.length > 0;
  const currentMatchesOption = hasOptions && availableTransitions.includes(value);

  return (
    <Field label="Transition Name" required>
      {hasOptions ? (
        <Select
          value={currentMatchesOption ? value : ''}
          onChange={(e) => {
            if (e.target.value) {
              onChange((d: any) => { d.transitionName = e.target.value; });
            }
          }}
          className="mb-1.5 text-xs"
        >
          <option value="">-- Select from workflow --</option>
          {availableTransitions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      ) : null}
      <Input type="text" value={value}
        onChange={(e) => onChange((d: any) => { d.transitionName = e.target.value; })}
        placeholder={hasOptions ? 'Or type manually...' : 'e.g. approve'}
        size="sm"
        inputClassName="font-mono text-xs" />
    </Field>
  );
}
