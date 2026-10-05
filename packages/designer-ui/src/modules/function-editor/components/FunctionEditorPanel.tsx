import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { ComponentDescriptionField } from '../../../ui/ComponentDescriptionField';
import { ComponentValidationSummary } from '../../save-component/components/ComponentValidationSummary';
import { FunctionCacheSection } from './FunctionCacheSection';
import { FunctionContractSection } from './FunctionContractSection';
import { FunctionMetadataForm } from './FunctionMetadataForm';
import { FunctionRolesSection } from './FunctionRolesSection';
import { FunctionTaskModeSection } from './FunctionTaskModeSection';
import { Field } from '../../../ui/Field';
import { Select } from '../../../ui/Select';
import { LabelEditor } from '../../save-component/components/LabelEditor';
import { hasFeature } from '../../schema-capabilities/SchemaCapabilities';
import { useSchemaCapabilities } from '../../schema-capabilities/useSchemaCapabilities';

interface FunctionEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  onBeforeOpenModal?: () => void;
}

/** Sets (or, for `undefined`, removes) one `attributes` field. */
function setAttribute(draft: Record<string, unknown>, field: string, value: unknown): void {
  const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
  if (value === undefined) delete attrs[field];
  else attrs[field] = value;
  draft.attributes = attrs;
}

export function FunctionEditorPanel({ json, onChange, onBeforeOpenModal }: FunctionEditorPanelProps) {
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const fnCaps = useSchemaCapabilities('function');
  const showExecutionLog = hasFeature(fnCaps, 'attributes.executionLog') || attrs.executionLog !== undefined;
  return (
    <div className="space-y-4 p-4">
      <ComponentValidationSummary />
      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Function Metadata</CardTitle>
          <CardDescription className="text-xs">Identity, scope and flow bindings.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <FunctionMetadataForm json={json} onChange={onChange} />
          <div className="mt-3">
            <ComponentDescriptionField
              value={String(json._comment || '')}
              onChange={(value) => onChange((d) => { d._comment = value || undefined; })}
            />
          </div>
          <div className="mt-3">
            <Field label="Labels" hint="Display names; the runtime returns them on the function catalog (0.0.99).">
              <LabelEditor
                labels={(attrs.labels as { language: string; label: string }[] | undefined) ?? []}
                onChange={(labels) => onChange((d) => setAttribute(d, 'labels', labels.length > 0 ? labels : undefined))}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <FunctionContractSection
        json={json}
        onChange={onChange}
        onBeforeOpenModal={onBeforeOpenModal}
      />

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Task Execution</CardTitle>
          <CardDescription className="text-xs">
            Choose between a single task or multiple ordered tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <FunctionTaskModeSection
            json={json}
            onChange={onChange}
            onBeforeOpenModal={onBeforeOpenModal}
          />
        </CardContent>
      </Card>

      <FunctionRolesSection json={json} onChange={onChange} />

      <FunctionCacheSection json={json} onChange={onChange} />

      {showExecutionLog && (
        <Card variant="default" className="gap-3">
          <CardHeader className="border-border border-b">
            <CardTitle className="text-base">Execution log</CardTitle>
            <CardDescription className="text-xs">
              Runtime 0.0.99 records each invocation in the function execution journal (latency, outcome, caller) when
              enabled; Quick Run shows it under the function's execution metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Field label="executionLog">
              <Select
                value={typeof attrs.executionLog === 'string' ? attrs.executionLog : ''}
                onChange={(e) => onChange((d) => setAttribute(d, 'executionLog', e.target.value || undefined))}
                className="text-xs"
                aria-label="Execution log">
                <option value="">Off (default)</option>
                <option value="E">E — record every invocation</option>
                <option value="D">D — do not record</option>
              </Select>
            </Field>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
