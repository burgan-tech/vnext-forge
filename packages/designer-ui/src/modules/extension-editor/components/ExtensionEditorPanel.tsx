import { ExtensionMetadataForm } from './ExtensionMetadataForm';
import { ExtensionTaskSection } from './ExtensionTaskSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';

interface ExtensionEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  onBeforeOpenModal?: () => void;
}

export function ExtensionEditorPanel({ json, onChange, onBeforeOpenModal }: ExtensionEditorPanelProps) {
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const task = attrs.task as Record<string, unknown> | null | undefined;
  const extensionKey = typeof json.key === 'string' ? json.key : 'extension';

  return (
    <div className="space-y-4 p-4">
      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Extension Metadata</CardTitle>
          <CardDescription className="text-xs">Identity, scope and flow bindings.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <ExtensionMetadataForm json={json} onChange={onChange} />
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Task</CardTitle>
          <CardDescription className="text-xs">
            The task that runs when this extension is invoked.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <ExtensionTaskSection
            task={task as any}
            onChange={onChange}
            extensionKey={extensionKey}
            onBeforeOpenModal={onBeforeOpenModal}
          />
        </CardContent>
      </Card>
    </div>
  );
}
