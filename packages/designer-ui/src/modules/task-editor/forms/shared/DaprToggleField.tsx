import { Field } from '../../../../ui/Field';
import { Select } from '../../../../ui/Select';

interface DaprToggleFieldProps {
  value: boolean | undefined;
  onChange: (updater: (draft: any) => void) => void;
}

export function DaprToggleField({ value, onChange }: DaprToggleFieldProps) {
  return (
    <Field label="Use Dapr">
      <Select
        value={value === true ? 'true' : 'false'}
        onChange={(e) => onChange((d: any) => { d.useDapr = e.target.value === 'true'; })}
        className="text-xs"
      >
        <option value="false">No</option>
        <option value="true">Yes</option>
      </Select>
    </Field>
  );
}
