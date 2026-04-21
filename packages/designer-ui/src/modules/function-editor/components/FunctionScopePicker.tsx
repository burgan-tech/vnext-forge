import { Field } from '../../../ui/Field';
import { RadioCard, RadioCardGroup } from '../../../ui/RadioCard';

const SCOPES = [
  { value: 'I', label: 'Instance', desc: 'Per instance' },
  { value: 'F', label: 'Workflow', desc: 'Per workflow' },
  { value: 'D', label: 'Domain', desc: 'Per domain' },
] as const;

interface FunctionScopePickerProps {
  value: string;
  onChange: (scope: string) => void;
  hint?: string;
}

export function FunctionScopePicker({ value, onChange, hint }: FunctionScopePickerProps) {
  return (
    <Field label="Scope" hint={hint} className="space-y-0">
      <RadioCardGroup
        value={value}
        onValueChange={(v) => onChange(String(v))}
        aria-label="Function scope"
        className="grid grid-cols-3 gap-1.5">
        {SCOPES.map((s) => (
          <RadioCard
            key={s.value}
            value={s.value}
            label={s.label}
            description={s.desc}
            className="h-auto min-h-0 min-w-0 shrink [&>span]:gap-1 [&>span]:px-2 [&>span]:py-1 [&_span.text-sm]:text-xs [&_span.text-xs]:text-[10px] [&_span.text-xs]:leading-tight"
          />
        ))}
      </RadioCardGroup>
    </Field>
  );
}
