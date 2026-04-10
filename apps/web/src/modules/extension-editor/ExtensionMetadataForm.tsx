import { Field } from '@modules/save-component/components/Field';
import { TagEditor } from '@modules/save-component/components/TagEditor';
import { ExtensionTypePicker } from './ExtensionTypePicker';
import { ExtensionScopePicker } from './ExtensionScopePicker';
import { DefinedFlowsSelector } from './DefinedFlowsSelector';

interface ExtensionMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function ExtensionMetadataForm({ json, onChange }: ExtensionMetadataFormProps) {
  const extensionType = typeof json.type === 'number' ? json.type : 1;
  const showDefinedFlows = extensionType === 3 || extensionType === 4;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">Extension Metadata</div>

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

      <ExtensionTypePicker
        value={extensionType as number}
        onChange={(type) => onChange((d) => { d.type = type; })}
      />

      <ExtensionScopePicker
        value={typeof json.scope === 'number' ? json.scope : 1}
        onChange={(scope) => onChange((d) => { d.scope = scope; })}
      />

      {showDefinedFlows && (
        <DefinedFlowsSelector
          flows={Array.isArray(json.definedFlows) ? json.definedFlows : []}
          onChange={(flows) => onChange((d) => { d.definedFlows = flows; })}
        />
      )}

      <Field label="Tags">
        <TagEditor
          tags={Array.isArray(json.tags) ? json.tags : []}
          onChange={(tags) => onChange((d) => { d.tags = tags; })}
        />
      </Field>
    </div>
  );
}
