import { Field } from '@modules/save-component/components/Field';

const SCOPES = [
  { value: 'I', label: 'Instance', desc: 'Per workflow instance' },
  { value: 'F', label: 'Workflow', desc: 'Per workflow definition' },
  { value: 'D', label: 'Domain', desc: 'Per domain' },
] as const;

interface FunctionScopePickerProps {
  value: string;
  onChange: (scope: string) => void;
}

export function FunctionScopePicker({ value, onChange }: FunctionScopePickerProps) {
  return (
    <Field label="Scope">
      <div className="flex gap-1">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
              value === s.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
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
