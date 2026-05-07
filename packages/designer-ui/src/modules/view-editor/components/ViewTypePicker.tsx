import { ViewType } from '@vnext-forge-studio/vnext-types';

import { RadioCard, RadioCardGroup } from '../../../ui/RadioCard';

const VIEW_TYPES = [
  { value: ViewType.Json, label: 'JSON', desc: 'Structured form data' },
  { value: ViewType.Html, label: 'HTML', desc: 'HTML template' },
  { value: ViewType.Markdown, label: 'Markdown', desc: 'Markdown content' },
  { value: ViewType.DeepLink, label: 'Deep Link', desc: 'App navigation URL' },
  { value: ViewType.Http, label: 'HTTP', desc: 'External web URL' },
  { value: ViewType.URN, label: 'URN', desc: 'Platform command' },
] as const;

interface ViewTypePickerProps {
  value: number;
  onChange: (type: number) => void;
}

export function ViewTypePicker({ value, onChange }: ViewTypePickerProps) {
  return (
    <RadioCardGroup
      value={value}
      onValueChange={(v: string | number) => onChange(Number(v))}
      aria-label="View content type"
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {VIEW_TYPES.map((t) => (
        <RadioCard key={t.value} value={t.value} label={t.label} description={t.desc} />
      ))}
    </RadioCardGroup>
  );
}
