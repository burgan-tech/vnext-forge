import { Field } from '../components/Field';

const TYPES = [
  { value: 1, label: 'Global', desc: 'Runs on all flows' },
  { value: 2, label: 'Global + Requested', desc: 'All flows + on-demand' },
  { value: 3, label: 'Defined Flows', desc: 'Specific flows only' },
  { value: 4, label: 'Defined + Requested', desc: 'Specific flows + on-demand' },
] as const;

interface ExtensionTypePickerProps {
  value: number;
  onChange: (type: number) => void;
}

export function ExtensionTypePicker({ value, onChange }: ExtensionTypePickerProps) {
  return (
    <Field label="Extension Type">
      <div className="grid grid-cols-2 gap-1">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`px-2 py-1.5 text-xs rounded border text-left transition-colors ${
              value === t.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="font-medium">{t.label}</div>
            <div className="text-[10px] opacity-70">{t.desc}</div>
          </button>
        ))}
      </div>
    </Field>
  );
}
