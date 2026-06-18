import { Field } from '../../../../ui/Field';
import { Select } from '../../../../ui/Select';

interface ContentTypeFieldProps {
  value: string | undefined;
  onChange: (updater: (draft: any) => void) => void;
}

const COMMON_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'text/plain',
  'text/xml',
  'application/xml',
  'text/html',
  'multipart/form-data',
  'application/octet-stream',
];

export function ContentTypeField({ value, onChange }: ContentTypeFieldProps) {
  return (
    <Field label="Content-Type">
      <Select
        value={String(value || '')}
        onChange={(e) => onChange((d: any) => { d.contentType = e.target.value || undefined; })}
        className="text-xs">
        <option value="">— None —</option>
        {COMMON_CONTENT_TYPES.map((ct) => (
          <option key={ct} value={ct}>{ct}</option>
        ))}
      </Select>
    </Field>
  );
}
