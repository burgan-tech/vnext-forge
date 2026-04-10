import { Field } from '@modules/save-component/components/Field';

const SCOPES = [
  { value: 1, label: 'Get Instance', desc: 'Single instance retrieval' },
  { value: 2, label: 'Get All Instances', desc: 'Multi-instance retrieval' },
  { value: 3, label: 'Everywhere', desc: 'All operations' },
] as const;

interface ExtensionScopePickerProps {
  value: number;
  onChange: (scope: number) => void;
  hint?: string;
}

export function ExtensionScopePicker({ value, onChange, hint }: ExtensionScopePickerProps) {
  return (
    <Field label="Extension Scope" hint={hint}>
      <div className="flex gap-1">
        {SCOPES.map((s) => (
          <button
            type="button"
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`flex-1 cursor-pointer px-2 py-1.5 text-xs rounded border transition-colors ${
              value === s.value
                ? 'border-primary-border-hover bg-primary-muted text-primary-text'
                : 'border-primary-border bg-primary text-primary-icon hover:border-primary-border-hover hover:bg-primary-hover hover:text-primary-text'
            }`}
          >
            <div className="font-medium">{s.label}</div>
            <div className="text-[10px] opacity-70">{s.desc}</div>
          </button>
        ))}
      </div>
    </Field>
  );
}
