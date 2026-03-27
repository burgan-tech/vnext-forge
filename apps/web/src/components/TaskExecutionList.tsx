import { Plus, Trash2, GripVertical } from 'lucide-react';
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
      draft.forEach((t: any, i: number) => { t.order = i + 1; });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">Task Executions ({tasks.length})</div>
        <button
          onClick={addTask}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <Plus size={10} /> Add Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">No task executions configured</div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task: any, i: number) => (
            <div key={i} className="border border-border rounded p-2 relative group">
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => moveTask(i, i - 1)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 rotate-180"
                  title="Move up"
                >
                  <GripVertical size={12} />
                </button>
                <button
                  onClick={() => removeTask(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground mb-1">#{i + 1}</div>
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
