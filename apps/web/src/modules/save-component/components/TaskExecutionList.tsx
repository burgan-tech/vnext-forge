import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/Alert';
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
          leftIconComponent={
            <span className="bg-success-surface text-success-icon group-hover/button:bg-success-hover flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200">
              <Plus size={12} />
            </span>
          }>
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
                    className="rotate-180"
                    title="Move up">
                    <GripVertical size={12} />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => removeTask(i)}
                    variant="default"
                    size="sm"
                    leftIconComponent={
                      <span className="bg-destructive-surface text-destructive-icon group-hover/button:bg-destructive-hover flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200">
                        <Trash2 size={12} />
                      </span>
                    }>
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
