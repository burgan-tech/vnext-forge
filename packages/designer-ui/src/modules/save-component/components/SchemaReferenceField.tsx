import { useState } from 'react';
import { ChevronRight, Database, Plus, Trash2 } from 'lucide-react';
import { Field } from '../../../ui/Field';

export interface SchemaReference {
  key: string;
  domain: string;
  version: string;
  flow: string;
}

interface SchemaReferenceFieldProps {
  value: SchemaReference | null | undefined;
  onChange: (ref: SchemaReference | null) => void;
  label?: string;
}

export function SchemaReferenceField({
  value,
  onChange,
  label = 'Schema',
}: SchemaReferenceFieldProps) {
  const [expanded, setExpanded] = useState(false);

  const handleCreate = () => {
    onChange({
      key: '',
      domain: '',
      version: '1.0.0',
      flow: 'sys-schemas',
    });
    setExpanded(true);
  };

  const handleRemove = () => {
    onChange(null);
    setExpanded(false);
  };

  const updateField = (field: keyof SchemaReference, nextValue: string) => {
    if (!value) return;
    onChange({ ...value, [field]: nextValue });
  };

  if (!value) {
    return (
      <Field label={label}>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded border border-dashed border-border px-2.5 py-2 text-xs font-medium text-primary-text transition-colors hover:border-primary-border hover:bg-primary-muted"
        >
          <Plus size={13} />
          <span>Add {label}</span>
        </button>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <div className="overflow-hidden rounded border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="flex flex-1 items-center gap-2 text-left text-xs text-primary-text"
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-primary-muted text-primary-text">
              <Database size={12} />
            </div>
            <span className="flex-1 truncate font-mono text-[11px]">
              {value.key ? `${value.key}@${value.domain || '?'}` : 'No schema configured'}
            </span>
            <ChevronRight
              size={14}
              className={`text-secondary-text transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="rounded p-1 text-secondary-text transition-colors hover:bg-destructive-muted hover:text-destructive-text"
            title="Remove schema"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {expanded ? (
          <div className="grid grid-cols-2 gap-2 px-2.5 py-2.5">
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-primary-text/75">Key</label>
              <input
                type="text"
                value={value.key}
                onChange={(event) => updateField('key', event.target.value)}
                placeholder="schema-key"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono text-primary-text outline-none transition-colors placeholder:text-secondary-text/60 focus:border-primary-border"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-primary-text/75">Domain</label>
              <input
                type="text"
                value={value.domain}
                onChange={(event) => updateField('domain', event.target.value)}
                placeholder="domain"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono text-primary-text outline-none transition-colors placeholder:text-secondary-text/60 focus:border-primary-border"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-primary-text/75">Version</label>
              <input
                type="text"
                value={value.version}
                onChange={(event) => updateField('version', event.target.value)}
                placeholder="1.0.0"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono text-primary-text outline-none transition-colors placeholder:text-secondary-text/60 focus:border-primary-border"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-primary-text/75">Flow</label>
              <input
                type="text"
                value={value.flow}
                disabled
                className="w-full cursor-not-allowed rounded border border-border bg-muted px-2 py-1 text-xs font-mono text-secondary-text"
              />
            </div>
          </div>
        ) : null}
      </div>
    </Field>
  );
}
