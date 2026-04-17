import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';

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

