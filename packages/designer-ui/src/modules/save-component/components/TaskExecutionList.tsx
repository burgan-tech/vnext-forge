import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';
import { TaskExecutionForm } from './TaskExecutionForm';

interface TaskExecutionListProps {
  tasks: any[];
  onChange: (updater: (draft: any[]) => void) => void;
}

export function TaskExecutionList({ tasks, onChange }: TaskExecutionListProps) {
  function addTask() {
    onChange((draft) => {
      draft.push({
        order: draft.length + 1,
        task: { key: '', domain: '', version: '', flow: '' },
      });
    });
  }

  function removeTask(index: number) {
    onChange((draft) => {
      draft.splice(index, 1);
    });
  }

  function moveTask(from: number, to: number) {
    if (to < 0 || to >= tasks.length) return;
    onChange((draft) => {
      const [item] = draft.splice(from, 1);
      draft.splice(to, 0, item);
      draft.forEach((t: any, i: number) => {
        t.order = i + 1;
      });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-foreground text-xs font-medium">Task Executions</div>
          <Badge variant={tasks.length > 0 ? 'success' : 'muted'}>{tasks.length}</Badge>
        </div>
        <Button
          type="button"
          onClick={addTask}
          variant="default"
          size="sm"
          leftIconType="default"
          leftIconVariant="success"
          leftIcon={<Plus aria-hidden />}>
          Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Alert variant="muted" className="py-2">
          <AlertTitle>No task executions configured</AlertTitle>
          <AlertDescription>
            Add at least one task to make this save component executable.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {tasks.map((task: any, i: number) => (
            <div
              key={i}
              className="border-primary-border bg-primary-surface/35 rounded-lg border p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Task #{i + 1}</Badge>
                  <span className="text-primary-text/70 text-[10px]">
                    Execution order is visible and editable below.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => moveTask(i, i - 1)}
                    disabled={i === 0}
                    variant="muted"
                    size="sm"
                    leftIconType="default"
                    leftIconVariant="muted"
                    leftIcon={<GripVertical aria-hidden />}
                    className="shrink-0 rotate-180"
                    title="Move up"
                    aria-label="Move task up"
                  />
                  <Button
                    type="button"
                    onClick={() => removeTask(i)}
                    variant="default"
                    size="sm"
                    leftIconType="solid"
                    leftIconVariant="destructive"
                    leftIcon={<Trash2 aria-hidden />}>
                    Remove Task
                  </Button>
                </div>
              </div>
              <TaskExecutionForm
                execution={task}
                onChange={(updater) => {
                  onChange((draft) => {
                    if (draft[i]) updater(draft[i]);
                  });
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
