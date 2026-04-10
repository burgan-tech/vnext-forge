import { Field } from '@modules/save-component/components/Field';

const SCOPES = [
  { value: 'I', label: 'Instance', desc: 'Per workflow instance' },
  { value: 'F', label: 'Workflow', desc: 'Per workflow definition' },
  { value: 'D', label: 'Domain', desc: 'Per domain' },
] as const;

interface FunctionScopePickerProps {
  value: string;
  onChange: (scope: string) => void;
  hint?: string;
}

export function FunctionScopePicker({ value, onChange, hint }: FunctionScopePickerProps) {
  return (
    <Field label="Scope" hint={hint}>
      <div className="flex gap-1">
        {SCOPES.map((s) => (
          <button
            type="button"
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`flex-1 cursor-pointer rounded border px-2 py-1.5 text-xs transition-colors ${
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
