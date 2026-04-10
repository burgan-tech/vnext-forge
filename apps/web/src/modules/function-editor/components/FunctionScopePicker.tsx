import { Button } from '@shared/ui/Button';
import { Field } from '@shared/ui/Field';

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
          <Button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            variant={value === s.value ? 'success' : 'default'}
            aria-pressed={value === s.value}
            className="h-auto flex-1 rounded-xl px-3 py-2 text-xs"
          >
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span className="font-medium">{s.label}</span>
              <span className="text-[10px] opacity-70">{s.desc}</span>
            </span>
          </Button>
        ))}
      </div>
    </Field>
  );
}

