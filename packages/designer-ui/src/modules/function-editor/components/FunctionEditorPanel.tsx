import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { ComponentDescriptionField } from '../../../ui/ComponentDescriptionField';
import { ComponentValidationSummary } from '../../save-component/components/ComponentValidationSummary';
import { FunctionMetadataForm } from './FunctionMetadataForm';
import { FunctionTaskModeSection } from './FunctionTaskModeSection';

interface FunctionEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  onBeforeOpenModal?: () => void;
}

export function FunctionEditorPanel({ json, onChange, onBeforeOpenModal }: FunctionEditorPanelProps) {
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
        </CardContent>
      </Card>

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
    </div>
  );
}
