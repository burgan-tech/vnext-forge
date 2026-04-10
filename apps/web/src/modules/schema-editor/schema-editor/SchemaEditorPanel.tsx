import { useState } from 'react';
import { SchemaMetadataForm } from './SchemaMetadataForm';
import { SchemaTree } from './SchemaTree';
import { JsonCodeField } from '@shared/ui/JsonCodeField';

interface SchemaEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function SchemaEditorPanel({ json, onChange }: SchemaEditorPanelProps) {
  const [view, setView] = useState<'visual' | 'source'>('visual');
  const attrs = json.attributes as Record<string, unknown> | undefined;
  const schema = (attrs?.schema || {}) as Record<string, unknown>;

  function onSchemaChange(updater: (draft: any) => void) {
    onChange((draft) => {
      if (!draft.attributes) draft.attributes = {};
      const attrs = draft.attributes as Record<string, unknown>;
      if (!attrs.schema) attrs.schema = {};
      updater(attrs.schema);
    });
  }

  return (
    <div className="p-4 space-y-4">
      <SchemaMetadataForm json={json} onChange={onChange} />

      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-xs font-medium">JSON Schema</div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setView('visual')}
              className={`px-2 py-0.5 text-[10px] rounded ${view === 'visual' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Visual
            </button>
            <button
              onClick={() => setView('source')}
              className={`px-2 py-0.5 text-[10px] rounded ${view === 'source' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Source
            </button>
          </div>
        </div>

        {view === 'visual' ? (
          <SchemaTree schema={schema} onChange={onSchemaChange} />
        ) : (
          <JsonCodeField
            value={JSON.stringify(schema, null, 2)}
            onChange={(v) => {
              try {
                const parsed = JSON.parse(v);
                onChange((draft) => {
                  if (!draft.attributes) draft.attributes = {};
                  (draft.attributes as any).schema = parsed;
                });
              } catch {
                // Invalid JSON, ignore
              }
            }}
            height={400}
          />
        )}
      </div>
    </div>
  );
}

