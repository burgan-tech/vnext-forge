import { Field } from '@shared/ui/Field';
import { TagEditor } from '@shared/ui/TagEditor';

interface SchemaMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function SchemaMetadataForm({ json, onChange }: SchemaMetadataFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key">
          <input type="text" value={String(json.key || '')} readOnly
            className="w-full px-2 py-1 text-xs border border-border rounded bg-muted font-mono" />
        </Field>
        <Field label="Version">
          <input type="text" value={String(json.version || '')}
            onChange={(e) => onChange((d) => { d.version = e.target.value; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
        </Field>
        <Field label="Domain">
          <input type="text" value={String(json.domain || '')}
            onChange={(e) => onChange((d) => { d.domain = e.target.value; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
        </Field>
        <Field label="Flow">
          <input type="text" value={String(json.flow || '')}
            onChange={(e) => onChange((d) => { d.flow = e.target.value; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
        </Field>
      </div>
      <Field label="Tags">
        <TagEditor
          tags={(json.tags as string[]) || []}
          onChange={(tags) => onChange((d) => { d.tags = tags; })}
        />
      </Field>
    </div>
  );
}

