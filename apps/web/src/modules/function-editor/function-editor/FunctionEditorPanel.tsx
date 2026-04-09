import { FunctionMetadataForm } from './FunctionMetadataForm';
import { TaskExecutionList } from '@modules/save-component/components/TaskExecutionList';

interface FunctionEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function FunctionEditorPanel({ json, onChange }: FunctionEditorPanelProps) {
  const tasks = Array.isArray(json.tasks) ? json.tasks : [];

  return (
    <div className="p-4 space-y-4">
      <FunctionMetadataForm json={json} onChange={onChange} />

      <div className="border-t border-border pt-4">
        <TaskExecutionList
          tasks={tasks}
          onChange={(updater) => {
            onChange((draft) => {
              if (!Array.isArray(draft.tasks)) draft.tasks = [];
              updater(draft.tasks as any[]);
            });
          }}
        />
      </div>
    </div>
  );
}
