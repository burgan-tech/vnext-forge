import { Field } from '@shared/ui/Field';

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
          <button
            type="button"
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`cursor-pointer px-2 py-1.5 text-xs rounded border text-left transition-colors ${
              value === t.value
                ? 'border-primary-border-hover bg-primary-muted text-primary-text'
                : 'border-primary-border bg-primary text-primary-icon hover:border-primary-border-hover hover:bg-primary-hover hover:text-primary-text'
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

