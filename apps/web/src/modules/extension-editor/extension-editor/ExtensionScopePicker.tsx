import { Field } from '@modules/save-component/components/Field';

const SCOPES = [
  { value: 1, label: 'Get Instance', desc: 'Single instance retrieval' },
  { value: 2, label: 'Get All Instances', desc: 'Multi-instance retrieval' },
  { value: 3, label: 'Everywhere', desc: 'All operations' },
] as const;

interface ExtensionScopePickerProps {
  value: number;
  onChange: (scope: number) => void;
}

export function ExtensionScopePicker({ value, onChange }: ExtensionScopePickerProps) {
  return (
    <Field label="Extension Scope">
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
