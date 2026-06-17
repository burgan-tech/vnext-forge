import { useParams } from 'react-router-dom';
import { WorkflowDetailPage } from '@monitoring/modules/definitions/workflow/WorkflowDetailPage';
import { TaskDetailPage } from '@monitoring/modules/definitions/task/TaskDetailPage';
import { FunctionDetailPage } from '@monitoring/modules/definitions/function/FunctionDetailPage';
import { ViewDetailPage } from '@monitoring/modules/definitions/view/ViewDetailPage';
import { ExtensionDetailPage } from '@monitoring/modules/definitions/extension/ExtensionDetailPage';
import { SchemaDetailPage } from '@monitoring/modules/definitions/schema/SchemaDetailPage';
import { MappingDetailPage } from '@monitoring/modules/definitions/mapping/MappingDetailPage';

export function ComponentDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();

  if (!type || !id) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
        Invalid route parameters
      </div>
    );
  }

  switch (type) {
    case 'workflow': return <WorkflowDetailPage id={id} />;
    case 'task': return <TaskDetailPage id={id} />;
    case 'function': return <FunctionDetailPage id={id} />;
    case 'view': return <ViewDetailPage id={id} />;
    case 'extension': return <ExtensionDetailPage id={id} />;
    case 'schema': return <SchemaDetailPage id={id} />;
    case 'mapping': return <MappingDetailPage id={id} />;
    default:
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
          Unknown component type: {type}
        </div>
      );
  }
}
