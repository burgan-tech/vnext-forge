import { Field } from '../../../ui/Field';
import { RadioCard, RadioCardGroup } from '../../../ui/RadioCard';

const TYPES = [
  { value: 1, label: 'Global', desc: 'Runs on all flows' },
  { value: 2, label: 'Global + Requested', desc: 'All flows + on-demand' },
  { value: 3, label: 'Defined Flows', desc: 'Specific flows only' },
  { value: 4, label: 'Defined + Requested', desc: 'Specific flows + on-demand' },
] as const;

interface ExtensionTypePickerProps {
  value: number;
  onChange: (type: number) => void;
  hint?: string;
}

export function ExtensionTypePicker({ value, onChange, hint }: ExtensionTypePickerProps) {
  return (
    <Field
      label="Extension Type"
      hint={hint}
      className="flex h-full min-h-0 flex-col gap-2 space-y-0">
      <RadioCardGroup
        value={value}
        onValueChange={(v) => onChange(Number(v))}
        aria-label="Extension type"
        className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
        {TYPES.map((t) => (
          <RadioCard key={t.value} value={t.value} label={t.label} description={t.desc} />
        ))}
      </RadioCardGroup>
    </Field>
  );
}
