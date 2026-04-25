import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';

interface ResourceReference {
  key?: string;
  domain?: string;
  version?: string;
  flow?: string;
}

interface ResourceReferenceFieldProps {
  label: string;
  value: ResourceReference;
  onChange: (value: ResourceReference) => void;
  showFlow?: boolean;
  readOnly?: boolean;
}

export function ResourceReferenceField({ label, value, onChange, showFlow, readOnly }: ResourceReferenceFieldProps) {
  function update(field: keyof ResourceReference, val: string) {
    onChange({ ...value, [field]: val || undefined });
  }

  return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-1">
        <Input
          type="text"
          value={value.key || ''}
          onChange={(e) => update('key', e.target.value)}
          placeholder="key"
          readOnly={readOnly}
          size="sm"
          className="min-w-0"
          inputClassName="text-xs font-mono"
        />
        <Input
          type="text"
          value={value.domain || ''}
          onChange={(e) => update('domain', e.target.value)}
          placeholder="domain"
          readOnly={readOnly}
          size="sm"
          className="min-w-0"
          inputClassName="text-xs font-mono"
        />
        <Input
          type="text"
          value={value.version || ''}
          onChange={(e) => update('version', e.target.value)}
          placeholder="version"
          readOnly={readOnly}
          size="sm"
          className="min-w-0"
          inputClassName="text-xs font-mono"
        />
        {showFlow && (
          <Input
            type="text"
            value={value.flow || ''}
            onChange={(e) => update('flow', e.target.value)}
            placeholder="flow"
            readOnly={readOnly}
            size="sm"
            className="min-w-0"
            inputClassName="text-xs font-mono"
          />
        )}
      </div>
    </Field>
  );
}
