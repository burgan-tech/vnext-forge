import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';

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
    <Field label="Extension Type" hint={hint}>
      <div className="grid grid-cols-2 gap-1">
        {TYPES.map((t) => (
          <Button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            variant={value === t.value ? 'success' : 'default'}
            aria-pressed={value === t.value}
            className="h-auto justify-start rounded-xl px-3 py-2 text-left text-xs"
          >
            <span className="flex flex-col items-start gap-0.5">
              <span className="font-medium">{t.label}</span>
              <span className="text-[10px] opacity-70">{t.desc}</span>
            </span>
          </Button>
        ))}
      </div>
    </Field>
  );
}

