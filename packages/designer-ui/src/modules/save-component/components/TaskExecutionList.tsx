import { useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import { Badge } from '../../../ui/Badge';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';
import { useProjectStore } from '../../../store/useProjectStore';
import {
  ChooseExistingTaskDialog,
  ChooseFromExistingTasksButton,
} from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import {
  CreateNewTaskDialog,
  CreateNewTaskButton,
} from '../../canvas-interaction/components/panels/tabs/CreateNewTaskDialog';
import { TaskExecutionForm } from './TaskExecutionForm';

interface TaskExecutionListProps {
  tasks: any[];
  onChange: (updater: (draft: any[]) => void) => void;
  /** Stable identifier for the parent context (passed to CsxEditorField). Defaults to "component". */
  stateKey?: string;
  /** List field path for the script panel store. Defaults to "tasks". */
  listField?: string;
  /** Called right before the modal opens so the parent can snapshot the component store. */
  onBeforeOpenModal?: () => void;
}

export function TaskExecutionList({
  tasks,
  onChange,
  stateKey = 'component',
  listField = 'tasks',
  onBeforeOpenModal,
}: TaskExecutionListProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  function addTaskFromComponent(component: DiscoveredVnextComponent) {
    onChange((draft) => {
      draft.push({
        order: draft.length + 1,
        task: {
          key: component.key,
          domain: projectDomain,
          version: component.version || '1.0.0',
          flow: component.flow || 'sys-tasks',
        },
      });
    });
  }

  function removeTask(index: number) {
    onChange((draft) => {
      draft.splice(index, 1);
      draft.forEach((t: any, i: number) => {
        t.order = i + 1;
      });
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
      </div>

      {tasks.length === 0 ? (
        <Alert variant="muted" className="py-2">
          <AlertTitle>No task executions configured</AlertTitle>
          <AlertDescription>
            Add a task from your workspace or create a new one.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {tasks.map((task: any, i: number) => (
            <TaskExecutionForm
              key={i}
              execution={task}
              index={i}
              total={tasks.length}
              onChange={(updater) => {
                onChange((draft) => {
                  if (draft[i]) updater(draft[i]);
                });
              }}
              onRemove={() => removeTask(i)}
              onMoveUp={() => moveTask(i, i - 1)}
              onMoveDown={() => moveTask(i, i + 1)}
              stateKey={stateKey}
              listField={listField}
              onBeforeOpenModal={onBeforeOpenModal}
            />
          ))}
        </div>
      )}

      <div
        className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
        role="group"
        aria-label="Add or attach execution task">
        <ChooseFromExistingTasksButton
          onClick={() => setPickerOpen(true)}
          disabled={!canPickExisting}
          title={
            canPickExisting
              ? 'Pick a task from workspace JSON files'
              : 'Requires an open project and vnext.config.json with paths'
          }
        />
        <CreateNewTaskButton
          onClick={() => setCreatorOpen(true)}
          disabled={!canPickExisting}
          title={
            canPickExisting
              ? 'Create a new task JSON under Tasks/<folder>/'
              : 'Requires an open project and vnext.config.json with paths'
          }
        />
      </div>

      <ChooseExistingTaskDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelectTask={addTaskFromComponent}
      />
      <CreateNewTaskDialog
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={addTaskFromComponent}
      />
    </div>
  );
}
