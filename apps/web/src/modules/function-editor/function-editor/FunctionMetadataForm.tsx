import { Field } from '../components/Field';
import { TagEditor } from '../components/TagEditor';
import { FunctionScopePicker } from './FunctionScopePicker';

interface FunctionMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function FunctionMetadataForm({ json, onChange }: FunctionMetadataFormProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">Function Metadata</div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Key">
          <input
            type="text"
            value={String(json.key || '')}
            onChange={(e) => onChange((d) => { d.key = e.target.value; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        </Field>
        <Field label="Version">
          <input
            type="text"
            value={String(json.version || '')}
            onChange={(e) => onChange((d) => { d.version = e.target.value; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        </Field>
        <Field label="Domain">
          <input
            type="text"
            value={String(json.domain || '')}
            onChange={(e) => onChange((d) => { d.domain = e.target.value; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        </Field>
        <Field label="Flow">
          <input
            type="text"
            value={String(json.flow || '')}
            onChange={(e) => onChange((d) => { d.flow = e.target.value || undefined; })}
            placeholder="(optional)"
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        </Field>
      </div>

      <FunctionScopePicker
        value={String(json.scope || 'I')}
        onChange={(scope) => onChange((d) => { d.scope = scope; })}
      />

      <Field label="Tags">
        <TagEditor
          tags={Array.isArray(json.tags) ? json.tags : []}
          onChange={(tags) => onChange((d) => { d.tags = tags; })}
        />
      </Field>
    </div>
  );
}
