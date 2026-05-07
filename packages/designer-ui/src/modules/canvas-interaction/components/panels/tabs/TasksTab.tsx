import { useState } from 'react';
import type { ErrorBoundary } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../store/useProjectStore';
import { CsxEditorField, type ScriptCode } from '../../../../../modules/save-component/components/CsxEditorField';
import { OpenVnextComponentInModalButton } from '../../../../../modules/save-component/components/OpenVnextComponentInModalButton.js';
import { useOpenComponentEditorModal } from '../../../../../modules/save-component/ComponentEditorModalContext.js';
import type { AtomicSavedInfo } from '../../../../../modules/save-component/componentEditorModalTypes.js';
import {
  componentPathToEditorRoute,
  resolveComponentEditorTargetByKeyFlowResult,
} from '../../../../../modules/vnext-workspace/resolveComponentEditorRoute.js';
import { showNotification } from '../../../../../notification/notification-port.js';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { ChooseExistingTaskDialog, ChooseFromExistingTasksButton } from './ChooseExistingTaskDialog';
import { CreateNewTaskButton, CreateNewTaskDialog } from './CreateNewTaskDialog';
import { useFlowEditorSave } from '../../../../../modules/flow-editor/FlowEditorSaveContext.js';
import { Section, IconTask, IconTrash, IconUp, IconDown } from './PropertyPanelShared';
import { TaskErrorBoundaryCollapsible } from './shared/TaskErrorBoundaryCollapsible';

/* ────────────── TASKS TAB ────────────── */

export function TasksTab({
  state,
  defaultTaskFolder,
}: {
  state: any;
  /** Same as the active workflow editor `group` — default Tasks/ subfolder when creating a task. */
  defaultTaskFolder?: string;
}) {
  const { updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [pickerListField, setPickerListField] = useState<'onEntries' | 'onExits' | null>(null);
  const [createListField, setCreateListField] = useState<'onEntries' | 'onExits' | null>(null);
  const flowEditorSave = useFlowEditorSave();
  const openComponentEditor = useOpenComponentEditorModal();
  const entries = state.onEntries || [];
  const exits = state.onExits || [];
  const stateKey = state.key;

  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  const addTaskFromDiscovered = (listField: 'onEntries' | 'onExits', task: DiscoveredVnextComponent) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (!s[listField]) s[listField] = [];
      s[listField].push({
        order: s[listField].length + 1,
        task: {
          key: task.key,
          domain: projectDomain,
          version: task.version || '1.0.0',
          flow: task.flow,
        },
      });
    });
  };

  const syncTaskRef = (
    listField: 'onEntries' | 'onExits',
    index: number,
    next: AtomicSavedInfo,
  ) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((st: any) => st.key === stateKey);
      const entry = s?.[listField]?.[index];
      if (!entry) return;
      if (!entry.task) entry.task = {};
      entry.task.key = next.key;
      entry.task.version = next.version;
      entry.task.domain = next.domain;
      entry.task.flow = next.flow;
    });
  };

  /** After "Create new task", open the atomic task editor so the user can edit JSON immediately. */
  const openTaskEditorForCreated = (
    created: DiscoveredVnextComponent,
    listField: 'onEntries' | 'onExits',
    newRowIndex: number,
  ) => {
    const projectId = activeProject?.id;
    const projectPath = activeProject?.path;
    if (!projectId || !projectPath || !vnextConfig?.paths) return;

    const onAtomicSaved = (next: AtomicSavedInfo) => syncTaskRef(listField, newRowIndex, next);

    if (created.path) {
      const route = componentPathToEditorRoute(created.path, projectPath, vnextConfig.paths, 'tasks');
      if (route) {
        openComponentEditor({
          kind: 'task',
          projectId,
          group: route.group,
          name: route.name,
          onAtomicSaved,
        });
        return;
      }
    }

    const k = created.key?.trim();
    const f = created.flow?.trim();
    if (!k || !f) return;

    void (async () => {
      try {
        const res = await resolveComponentEditorTargetByKeyFlowResult(
          projectId,
          projectPath,
          vnextConfig.paths,
          k,
          f,
        );
        if (!res.ok) {
          showNotification({
            kind: 'error',
            message:
              res.failure === 'not_found'
                ? 'Could not open the task editor. Open it from the task card.'
                : 'Could not map the task file to the editor.',
          });
          return;
        }
        openComponentEditor({
          kind: res.target.kind,
          projectId,
          group: res.target.group,
          name: res.target.name,
          onAtomicSaved,
        });
      } catch {
        showNotification({ kind: 'error', message: 'Could not open the task editor.' });
      }
    })();
  };

  const removeTask = (listField: 'onEntries' | 'onExits', index: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.[listField]) return;
      s[listField].splice(index, 1);
      s[listField].forEach((t: any, i: number) => {
        t.order = i + 1;
      });
    });
  };

  const moveTask = (listField: 'onEntries' | 'onExits', fromIndex: number, toIndex: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.[listField]) return;
      const arr = s[listField];
      if (toIndex < 0 || toIndex >= arr.length) return;
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      arr.forEach((t: any, i: number) => {
        t.order = i + 1;
      });
    });
  };

  const updateMapping = (
    listField: 'onEntries' | 'onExits',
    index: number,
    mapping: ScriptCode,
  ) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      const entry = s?.[listField]?.[index];
      if (!entry) return;
      entry.mapping = mapping;
    });
  };

  const removeMapping = (listField: 'onEntries' | 'onExits', index: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      const entry = s?.[listField]?.[index];
      if (!entry) return;
      delete entry.mapping;
    });
  };

  const updateTaskComment = (
    listField: 'onEntries' | 'onExits',
    index: number,
    comment: string | undefined,
  ) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      const entry = s?.[listField]?.[index];
      if (!entry) return;
      if (comment) {
        entry._comment = comment;
      } else {
        delete entry._comment;
      }
    });
  };

  const updateErrorBoundary = (
    listField: 'onEntries' | 'onExits',
    index: number,
    eb: ErrorBoundary | undefined,
  ) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      const entry = s?.[listField]?.[index];
      if (!entry) return;
      if (eb) {
        entry.errorBoundary = eb;
      } else {
        delete entry.errorBoundary;
      }
    });
  };

  return (
    <div className="space-y-4">
      <ChooseExistingTaskDialog
        open={pickerListField != null}
        onOpenChange={(open) => {
          if (!open) setPickerListField(null);
        }}
        onSelectTask={(task) => {
          if (pickerListField) addTaskFromDiscovered(pickerListField, task);
        }}
      />
      <CreateNewTaskDialog
        open={createListField != null}
        onOpenChange={(open) => {
          if (!open) setCreateListField(null);
        }}
        defaultTaskFolder={defaultTaskFolder}
        onCreated={(created) => {
          if (!createListField) return;
          const listField = createListField;
          const newRowIndex = listField === 'onEntries' ? entries.length : exits.length;
          addTaskFromDiscovered(listField, created);
          void flowEditorSave?.saveWorkflow();
          openTaskEditorForCreated(created, listField, newRowIndex);
        }}
      />
      <Section title="OnEntry" count={entries.length} icon={<IconTask />} defaultOpen>
        {entries.length === 0 ? (
          <div className="text-muted-foreground py-4 text-center text-[12px]">
            No entry tasks defined
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((t: any, i: number) => (
              <EditableTaskCard
                key={i}
                entry={t}
                index={i}
                total={entries.length}
                listField="onEntries"
                stateKey={stateKey}
                onRemove={removeTask}
                onMove={moveTask}
                onUpdateComment={updateTaskComment}
                onUpdateMapping={updateMapping}
                onRemoveMapping={removeMapping}
                onUpdateErrorBoundary={updateErrorBoundary}
                onAtomicSaved={syncTaskRef}
              />
            ))}
          </div>
        )}
        <div
          className="mt-2 flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
          role="group"
          aria-label="Add or attach entry task">
          <ChooseFromExistingTasksButton
            onClick={() => setPickerListField('onEntries')}
            disabled={!canPickExisting}
            title={
              canPickExisting
                ? 'Pick a task from workspace JSON files'
                : 'Requires an open project and vnext.config.json with paths'
            }
          />
          <CreateNewTaskButton
            onClick={() => setCreateListField('onEntries')}
            disabled={!canPickExisting}
            title={
              canPickExisting
                ? 'Create a new task JSON under Tasks/<folder>/'
                : 'Requires an open project and vnext.config.json with paths'
            }
          />
        </div>
      </Section>

      <Section title="OnExit" count={exits.length} icon={<IconTask />} defaultOpen>
        {exits.length === 0 ? (
          <div className="text-muted-foreground py-4 text-center text-[12px]">
            No exit tasks defined
          </div>
        ) : (
          <div className="space-y-2">
            {exits.map((t: any, i: number) => (
              <EditableTaskCard
                key={i}
                entry={t}
                index={i}
                total={exits.length}
                listField="onExits"
                stateKey={stateKey}
                onRemove={removeTask}
                onMove={moveTask}
                onUpdateComment={updateTaskComment}
                onUpdateMapping={updateMapping}
                onRemoveMapping={removeMapping}
                onUpdateErrorBoundary={updateErrorBoundary}
                onAtomicSaved={syncTaskRef}
              />
            ))}
          </div>
        )}
        <div
          className="mt-2 flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
          role="group"
          aria-label="Add or attach exit task">
          <ChooseFromExistingTasksButton
            onClick={() => setPickerListField('onExits')}
            disabled={!canPickExisting}
            title={
              canPickExisting
                ? 'Pick a task from workspace JSON files'
                : 'Requires an open project and vnext.config.json with paths'
            }
          />
          <CreateNewTaskButton
            onClick={() => setCreateListField('onExits')}
            disabled={!canPickExisting}
            title={
              canPickExisting
                ? 'Create a new task JSON under Tasks/<folder>/'
                : 'Requires an open project and vnext.config.json with paths'
            }
          />
        </div>
      </Section>
    </div>
  );
}

/* ────────────── TASK CARD (read-only ref; edit in modal) ────────────── */

function EditableTaskCard({
  entry,
  index,
  total,
  listField,
  stateKey,
  onRemove,
  onMove,
  onUpdateComment,
  onUpdateMapping,
  onRemoveMapping,
  onUpdateErrorBoundary,
  onAtomicSaved,
}: {
  entry: any;
  index: number;
  total: number;
  listField: 'onEntries' | 'onExits';
  stateKey: string;
  onRemove: (listField: 'onEntries' | 'onExits', index: number) => void;
  onMove: (listField: 'onEntries' | 'onExits', fromIndex: number, toIndex: number) => void;
  onUpdateComment: (listField: 'onEntries' | 'onExits', index: number, comment: string | undefined) => void;
  onUpdateMapping: (listField: 'onEntries' | 'onExits', index: number, mapping: ScriptCode) => void;
  onRemoveMapping: (listField: 'onEntries' | 'onExits', index: number) => void;
  onUpdateErrorBoundary: (listField: 'onEntries' | 'onExits', index: number, eb: ErrorBoundary | undefined) => void;
  onAtomicSaved: (listField: 'onEntries' | 'onExits', index: number, next: AtomicSavedInfo) => void;
}) {
  const ref = entry.task || entry;
  const mapping = entry.mapping;
  const order = entry.order ?? index + 1;

  return (
    <div className="bg-surface border-border hover:border-muted-border-hover overflow-hidden rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div className="mt-0.5 flex shrink-0 flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(listField, index, index - 1)}
            disabled={index === 0}
            className="text-subtle hover:text-secondary-icon cursor-pointer p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            title="Move up">
            <IconUp />
          </button>
          <span className="bg-intermediate/10 text-intermediate flex size-6 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums">
            {order}
          </span>
          <button
            type="button"
            onClick={() => onMove(listField, index, index + 1)}
            disabled={index === total - 1}
            className="text-subtle hover:text-secondary-icon cursor-pointer p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            title="Move down">
            <IconDown />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground font-mono text-[12px] font-semibold tracking-tight">
              {ref.key || '?'}
            </span>
            {ref.domain && <span className="text-muted-foreground text-[11px]">@{ref.domain}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            {ref.version && (
              <span className="text-muted-foreground font-mono text-[10px]">v{ref.version}</span>
            )}
            {ref.flow && (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-[10px]">
                {ref.flow}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {ref.key && ref.flow ? (
            <OpenVnextComponentInModalButton
              componentKey={String(ref.key)}
              flow={String(ref.flow)}
              className="shrink-0 rounded-lg p-1.5"
              title="Open task JSON in editor (modal)"
              iconOnly
              onAtomicSaved={(next) => onAtomicSaved(listField, index, next)}
            />
          ) : null}
          <button
            type="button"
            onClick={() => onRemove(listField, index)}
            className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1.5 transition-all">
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Task execution description */}
      <div className="px-3 pb-2">
        <label className="text-muted-foreground text-[10px] font-semibold mb-0.5 block">Description</label>
        <textarea
          value={entry._comment ?? ''}
          onChange={(e) => onUpdateComment(listField, index, e.target.value || undefined)}
          placeholder="Task execution description..."
          rows={1}
          aria-label="Task execution description"
          className="w-full px-2.5 py-1.5 text-xs font-mono border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all resize-y placeholder:text-subtle"
        />
      </div>

      <CsxEditorField
        value={mapping}
        onChange={(m) => onUpdateMapping(listField, index, m)}
        onRemove={() => onRemoveMapping(listField, index)}
        templateType="mapping"
        contextName={`${stateKey}-${ref.key || 'task'}`}
        label="Mapping"
        stateKey={stateKey}
        listField={listField}
        index={index}
        scriptField="mapping"
      />

      <TaskErrorBoundaryCollapsible
        errorBoundary={entry.errorBoundary}
        onChange={(eb) => onUpdateErrorBoundary(listField, index, eb)}
      />
    </div>
  );
}
