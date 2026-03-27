import { Field } from './Field';

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
        <input
          type="text"
          value={value.key || ''}
          onChange={(e) => update('key', e.target.value)}
          placeholder="key"
          readOnly={readOnly}
          className="px-2 py-1 text-xs border border-border rounded bg-background font-mono"
        />
        <input
          type="text"
          value={value.domain || ''}
          onChange={(e) => update('domain', e.target.value)}
          placeholder="domain"
          readOnly={readOnly}
          className="px-2 py-1 text-xs border border-border rounded bg-background font-mono"
        />
        <input
          type="text"
          value={value.version || ''}
          onChange={(e) => update('version', e.target.value)}
          placeholder="version"
          readOnly={readOnly}
          className="px-2 py-1 text-xs border border-border rounded bg-background font-mono"
        />
        {showFlow && (
          <input
            type="text"
            value={value.flow || ''}
            onChange={(e) => update('flow', e.target.value)}
            placeholder="flow"
            readOnly={readOnly}
            className="px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        )}
      </div>
    </Field>
  );
}
