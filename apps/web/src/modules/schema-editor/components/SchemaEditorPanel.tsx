import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@shared/ui/Tabs';
import { Field } from '@shared/ui/Field';
import { JsonCodeField } from '@shared/ui/JsonCodeField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { SchemaMetadataForm } from './SchemaMetadataForm';
import { SchemaTree } from './SchemaTree';
import { ValidatePayloadCard } from './ValidatePayloadCard';
import { getSchemaSource } from '../SchemaEditorSchema';

interface SchemaEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function SchemaEditorPanel({ json, onChange }: SchemaEditorPanelProps) {
  const [view, setView] = useState<'visual' | 'source'>('visual');
  const schema = getSchemaSource(json);
  const [sourceValue, setSourceValue] = useState(() => JSON.stringify(schema, null, 2));
  const [sourceError, setSourceError] = useState<string | null>(null);

  useEffect(() => {
    if (view !== 'source') {
      setSourceValue(JSON.stringify(schema, null, 2));
      setSourceError(null);
    }
  }, [schema, view]);

  function onSchemaChange(updater: (draft: Record<string, unknown>) => void) {
    onChange((draft) => {
      if (!draft.attributes) draft.attributes = {};
      const nextAttributes = draft.attributes as Record<string, unknown>;
      if (!nextAttributes.schema) nextAttributes.schema = {};
      updater(nextAttributes.schema as Record<string, unknown>);
    });
  }

  return (
    <div className="space-y-4 p-4">
      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Schema Metadata</CardTitle>
          <CardDescription className="text-xs">Identity and flow bindings.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <SchemaMetadataForm json={json} onChange={onChange} />
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b flex-row items-center">
          <div>
            <CardTitle className="text-base">JSON Schema</CardTitle>
            <CardDescription className="text-xs">Visual or source editing.</CardDescription>
          </div>
          <Tabs
            value={view}
            onValueChange={(nextView) => setView(nextView as 'visual' | 'source')}
            className="ml-auto">
            <TabsList variant="default" className="h-8 gap-1 p-1">
              <TabsTrigger value="visual" variant="default" className="px-2 py-1 text-[10px]">
                Visual
              </TabsTrigger>
              <TabsTrigger value="source" variant="default" className="px-2 py-1 text-[10px]">
                Source
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {view === 'visual' ? (
            <SchemaTree schema={schema} onChange={onSchemaChange} />
          ) : (
            <Field
              label="Schema Source"
              hint="Inline validation keeps invalid JSON in the editor until it becomes valid."
              errorMsg={sourceError}>
              <JsonCodeField
                value={sourceValue}
                onChange={(value) => {
                  setSourceValue(value);

                  try {
                    const parsed = JSON.parse(value);

                    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                      setSourceError('Schema source must be a JSON object.');
                      return;
                    }

                    setSourceError(null);
                    onChange((draft) => {
                      if (!draft.attributes) {
                        draft.attributes = {};
                      }

                      (draft.attributes as Record<string, unknown>).schema = parsed;
                    });
                  } catch {
                    setSourceError('Schema source must be valid JSON.');
                  }
                }}
                height={400}
              />
            </Field>
          )}
        </CardContent>
      </Card>
      <ValidatePayloadCard schema={schema} />
    </div>
  );
}
