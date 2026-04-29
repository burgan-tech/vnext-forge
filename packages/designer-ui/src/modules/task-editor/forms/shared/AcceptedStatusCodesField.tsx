import { Field } from '../../../../ui/Field';
import { TagEditor } from '../../../../ui/TagEditor';

interface AcceptedStatusCodesFieldProps {
  value: string[] | undefined;
  onChange: (updater: (draft: any) => void) => void;
}

export function AcceptedStatusCodesField({ value, onChange }: AcceptedStatusCodesFieldProps) {
  return (
    <Field label="Accepted Status Codes">
      <TagEditor
        tags={value ?? []}
        onChange={(tags) => onChange((d: any) => { d.acceptedStatusCodes = tags.length > 0 ? tags : undefined; })}
        placeholder='e.g. 403, 4xx, 5xx'
      />
    </Field>
  );
}
