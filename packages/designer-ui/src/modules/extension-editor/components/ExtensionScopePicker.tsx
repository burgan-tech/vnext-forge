import { Field } from '../../../ui/Field';
import { RadioCard, RadioCardGroup } from '../../../ui/RadioCard';

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
    <Field
      label="Extension Scope"
      hint={hint}
      className="flex h-full min-h-0 flex-col gap-1.5 space-y-0">
      <RadioCardGroup
        value={value}
        onValueChange={(v) => onChange(Number(v))}
        aria-label="Extension scope"
        className="flex min-h-0 flex-1 flex-col justify-start gap-1">
        {SCOPES.map((s) => (
          <RadioCard
            key={s.value}
            value={s.value}
            label={s.label}
            description={s.desc}
            className="my-px h-auto min-h-0 w-full shrink-0 [&>span]:px-2.5 [&>span]:py-1.5"
          />
        ))}
      </RadioCardGroup>
    </Field>
  );
}
