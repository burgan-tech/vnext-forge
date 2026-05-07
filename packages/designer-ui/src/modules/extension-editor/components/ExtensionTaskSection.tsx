import { useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';
import { useProjectStore } from '../../../store/useProjectStore';
import {
  ChooseExistingTaskDialog,
  ChooseFromExistingTasksButton,
  ChooseFromExistingVnextComponentButton,
} from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import {
  CreateNewTaskDialog,
  CreateNewTaskButton,
} from '../../canvas-interaction/components/panels/tabs/CreateNewTaskDialog';
import { CsxEditorField, type ScriptCode } from '../../save-component/components/CsxEditorField';
import { OpenVnextComponentInModalButton } from '../../save-component/components/OpenVnextComponentInModalButton.js';
import type { AtomicSavedInfo } from '../../save-component/componentEditorModalTypes.js';

interface ExtensionTask {
  order?: number;
  task?: {
    key?: string;
    domain?: string;
    version?: string;
    flow?: string;
  };
  mapping?: ScriptCode | null;
}

interface ExtensionTaskSectionProps {
  task: ExtensionTask | null | undefined;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  extensionKey: string;
  /** Called right before the modal opens so the parent can snapshot the component store. */
  onBeforeOpenModal?: () => void;
}

export function ExtensionTaskSection({ task, onChange, extensionKey, onBeforeOpenModal }: ExtensionTaskSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  const hasTask = task != null && task.task != null && Boolean(task.task.key);

  function setTaskFromComponent(component: DiscoveredVnextComponent) {
    onChange((draft) => {
      const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
      attrs.task = {
        order: 1,
        task: {
          key: component.key,
          domain: projectDomain,
          version: component.version || '1.0.0',
          flow: component.flow || 'sys-tasks',
        },
      };
      draft.attributes = attrs;
    });
  }

  function removeTask() {
    onChange((draft) => {
      const attrs = draft.attributes as Record<string, unknown> | undefined;
      if (attrs) {
        delete attrs.task;
      }
    });
  }

  function handleUpdateMapping(value: ScriptCode) {
    onChange((draft) => {
      const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
      const t = (attrs.task ?? {}) as Record<string, unknown>;
      t.mapping = value;
      attrs.task = t;
      draft.attributes = attrs;
    });
  }

  function handleRemoveMapping() {
    onChange((draft) => {
      const attrs = draft.attributes as Record<string, unknown> | undefined;
      const t = attrs?.task as Record<string, unknown> | undefined;
      if (t) {
        delete t.mapping;
      }
    });
  }

  function handleAtomicSaved(next: AtomicSavedInfo) {
    onChange((draft) => {
      const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
      const t = (attrs.task ?? {}) as Record<string, unknown>;
      if (!t.task) t.task = {};
      const taskRef = t.task as Record<string, unknown>;
      taskRef.key = next.key;
      taskRef.version = next.version;
      taskRef.domain = next.domain;
      taskRef.flow = next.flow;
      attrs.task = t;
      draft.attributes = attrs;
    });
  }

  if (!hasTask) {
    return (
      <div className="space-y-3">
        <Alert variant="muted" className="py-2">
          <AlertTitle>No task configured</AlertTitle>
          <AlertDescription>
            Attach a task from your workspace or create a new one.
          </AlertDescription>
        </Alert>

        <div
          className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
          role="group"
          aria-label="Attach extension task">
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
          onSelectTask={setTaskFromComponent}
        />
        <CreateNewTaskDialog
          open={creatorOpen}
          onOpenChange={setCreatorOpen}
          onCreated={setTaskFromComponent}
        />
      </div>
    );
  }

  const ref = task!.task!;
  const mapping = task!.mapping;

  return (
    <div className="space-y-3">
      <div className="bg-surface border-border hover:border-muted-border-hover overflow-hidden rounded-lg border shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all">
        <div className="flex items-start gap-2 px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground font-mono text-[11px] font-semibold tracking-tight">
                {ref.key || '?'}
              </span>
              {ref.domain && <span className="text-muted-foreground text-[10px]">@{ref.domain}</span>}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              {ref.version && (
                <span className="text-muted-foreground font-mono text-[9px]">v{ref.version}</span>
              )}
              {ref.flow && (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-[9px]">
                  {ref.flow}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {ref.key && ref.flow && (
              <div onClickCapture={onBeforeOpenModal}>
                <OpenVnextComponentInModalButton
                  componentKey={String(ref.key)}
                  flow={String(ref.flow)}
                  className="shrink-0 rounded-lg p-1"
                  title="Open task JSON in editor (modal)"
                  iconOnly
                  onAtomicSaved={handleAtomicSaved}
                />
              </div>
            )}
            <button
              type="button"
              onClick={removeTask}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all"
              aria-label={`Remove task ${ref.key || 'entry'}`}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <CsxEditorField
          value={mapping as ScriptCode | null | undefined}
          onChange={handleUpdateMapping}
          onRemove={handleRemoveMapping}
          templateType="mapping"
          contextName={`${extensionKey}-ext-task-${ref.key || 'task'}`}
          label="Mapping"
          stateKey={extensionKey}
          listField="attributes"
          index={0}
          scriptField="task.mapping"
        />
      </div>

      <div
        className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
        role="group"
        aria-label="Replace extension task">
        <ChooseFromExistingVnextComponentButton
          category="tasks"
          onClick={() => setPickerOpen(true)}
          disabled={!canPickExisting}
          title={
            canPickExisting
              ? 'Replace with a different task from workspace'
              : 'Requires an open project and vnext.config.json with paths'
          }
          label="Replace from existing tasks"
        />
        <CreateNewTaskButton
          onClick={() => setCreatorOpen(true)}
          disabled={!canPickExisting}
          title={
            canPickExisting
              ? 'Create a new task to replace the current one'
              : 'Requires an open project and vnext.config.json with paths'
          }
          label="Replace with new task"
        />
      </div>

      <ChooseExistingTaskDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelectTask={setTaskFromComponent}
      />
      <CreateNewTaskDialog
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={setTaskFromComponent}
      />
    </div>
  );
}
