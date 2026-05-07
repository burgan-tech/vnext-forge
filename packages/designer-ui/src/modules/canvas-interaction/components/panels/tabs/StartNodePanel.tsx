import { useMemo, useCallback, useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../store/useProjectStore';
import {
  SchemaReferenceField,
  type SchemaReference,
} from '../../../../../modules/save-component/components/SchemaReferenceField';
import type { ScriptCode } from '../../../../../modules/save-component/components/CsxEditorField';
import type { AtomicSavedInfo } from '../../../../../modules/save-component/componentEditorModalTypes';
import { getLabels, getLabel, getTriggerLabel } from './PropertyPanelHelpers';
import { Badge, Section, InfoRow, SelectField } from './PropertyPanelShared';
import { Play, Plus, Trash2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../../ui/Tooltip';
import { OpenVnextComponentInModalButton } from '../../../../../modules/save-component/components/OpenVnextComponentInModalButton.js';
import { TransitionMappingSection } from './transition/TransitionMappingSection';
import { TransitionRolesSection } from './transition/TransitionRolesSection';
import { TransitionExecutionTasksSection } from './transition/TransitionExecutionTasksSection';
import { ChooseExistingTaskDialog } from './ChooseExistingTaskDialog';

export function StartNodePanel({ startTransition }: { startTransition: any }) {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);
  const target = startTransition.target || startTransition.to || '';
  const schema = startTransition.schema;
  const labels = getLabels(startTransition);
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  const allStateKeys = useMemo(() => {
    type Attrs = { states?: Array<{ key: string }> };
    const attrs = workflowJson?.attributes as Attrs | undefined;
    return (attrs?.states || []).map((s) => s.key);
  }, [workflowJson]);

  const resolveStart = (draft: any) =>
    draft.attributes?.startTransition || draft.attributes?.start;

  const updateStartField = (field: string, value: any) => {
    updateWorkflow((draft: any) => {
      const st = resolveStart(draft);
      if (st) st[field] = value;
    });
  };

  const updateSchema = (ref: SchemaReference | null) => {
    updateWorkflow((draft: any) => {
      const st = resolveStart(draft);
      if (st) st.schema = ref;
    });
  };

  const updateMapping = useCallback(
    (mapping: ScriptCode) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        if (st) st.mapping = mapping;
      });
    },
    [updateWorkflow],
  );

  const removeMapping = useCallback(() => {
    updateWorkflow((draft: any) => {
      const st = resolveStart(draft);
      if (st) delete st.mapping;
    });
  }, [updateWorkflow]);

  const updateRoles = useCallback(
    (roles: RoleGrant[]) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        if (st) st.roles = roles;
      });
    },
    [updateWorkflow],
  );

  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';

  const addTask = useCallback(
    (task: DiscoveredVnextComponent) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        if (!st) return;
        if (!st.onExecutionTasks) st.onExecutionTasks = [];
        st.onExecutionTasks.push({
          order: st.onExecutionTasks.length,
          task: {
            key: task.key,
            domain: projectDomain,
            version: task.version ?? '1.0.0',
            flow: task.flow || 'sys-tasks',
          },
        });
      });
    },
    [updateWorkflow, projectDomain],
  );

  const removeTask = useCallback(
    (taskIndex: number) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        st?.onExecutionTasks?.splice(taskIndex, 1);
      });
    },
    [updateWorkflow],
  );

  const moveTask = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        const tasks = st?.onExecutionTasks;
        if (!tasks) return;
        const [item] = tasks.splice(fromIndex, 1);
        tasks.splice(toIndex, 0, item);
      });
    },
    [updateWorkflow],
  );

  const updateTaskMapping = useCallback(
    (taskIndex: number, mapping: ScriptCode) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        const task = st?.onExecutionTasks?.[taskIndex];
        if (task) task.mapping = mapping;
      });
    },
    [updateWorkflow],
  );

  const removeTaskMapping = useCallback(
    (taskIndex: number) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        const task = st?.onExecutionTasks?.[taskIndex];
        if (task) delete task.mapping;
      });
    },
    [updateWorkflow],
  );

  const updateTaskErrorBoundary = useCallback(
    (taskIndex: number, eb: any) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        const task = st?.onExecutionTasks?.[taskIndex];
        if (task) task.errorBoundary = eb;
      });
    },
    [updateWorkflow],
  );

  const syncTaskRef = useCallback(
    (taskIndex: number, next: AtomicSavedInfo) => {
      updateWorkflow((draft: any) => {
        const st = resolveStart(draft);
        const task = st?.onExecutionTasks?.[taskIndex];
        if (!task?.task) return;
        task.task.key = next.key;
        task.task.domain = next.domain;
        task.task.version = next.version;
      });
    },
    [updateWorkflow],
  );

  const [taskPickerOpen, setTaskPickerOpen] = useState(false);

  const addLabel = () => {
    updateWorkflow((draft: any) => {
      const st = resolveStart(draft);
      if (!st) return;
      if (!st.labels) st.labels = [];
      st.labels.push({ label: '', language: 'en' });
    });
  };

  const removeLabel = (index: number) => {
    updateWorkflow((draft: any) => {
      const st = resolveStart(draft);
      if (!st?.labels) return;
      st.labels.splice(index, 1);
    });
  };

  const updateLabel = (index: number, field: 'label' | 'language', value: string) => {
    updateWorkflow((draft: any) => {
      const st = resolveStart(draft);
      if (!st?.labels?.[index]) return;
      st.labels[index][field] = value;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-border-subtle bg-surface border-b px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2">
          <div className="bg-initial/10 flex size-8 items-center justify-center rounded-xl">
            <Play size={14} className="text-initial" />
          </div>
          <span className="text-foreground text-[14px] font-bold tracking-tight">
            Start Transition
          </span>
          <Badge className="bg-initial/10 text-initial">Entry Point</Badge>
        </div>
        {getLabel(startTransition) && (
          <div className="text-muted-foreground ml-10 text-[12px]">{getLabel(startTransition)}</div>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <InfoRow label="Key" value={startTransition.key || 'start'} mono copyable />

        {/* Editable target */}
        <div>
          <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
            Target
          </label>
          <select
            value={target}
            onChange={(e) => updateStartField('target', e.target.value)}
            className="border-border bg-muted-surface text-secondary-icon focus:ring-ring/20 focus:border-primary-border focus:bg-surface w-full cursor-pointer rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-all focus:ring-2 focus:outline-none">
            {!allStateKeys.includes(target) && target && <option value={target}>{target}</option>}
            {allStateKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <InfoRow label="Trigger" value={getTriggerLabel(startTransition.triggerType ?? 0)} />

        {/* Editable version strategy */}
        <div>
          <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
            Version Strategy
          </label>
          <SelectField
            value={startTransition.versionStrategy || 'Minor'}
            onChange={(v) => updateStartField('versionStrategy', v)}
            options={[
              { value: 'Minor', label: 'Minor' },
              { value: 'Major', label: 'Major' },
            ]}
          />
        </div>

        {/* Editable schema */}
        <Section title="Schema" defaultOpen>
          <SchemaReferenceField value={schema} onChange={updateSchema} />
          {schema?.key && schema?.flow ? (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <OpenVnextComponentInModalButton
                componentKey={String(schema.key)}
                flow={String(schema.flow)}
                title="Open schema JSON in modal"
              />
            </div>
          ) : null}
        </Section>

        {/* Mapping */}
        <TransitionMappingSection
          mapping={(startTransition.mapping as ScriptCode | undefined) ?? null}
          stateKey="__start__"
          transitionKey={startTransition.key || 'start'}
          index={0}
          onChange={updateMapping}
          onRemove={removeMapping}
        />

        {/* On execution tasks */}
        <TransitionExecutionTasksSection
          tasks={startTransition.onExecutionTasks ?? []}
          stateKey="__start__"
          transitionIndex={0}
          onAddTask={addTask}
          onRemoveTask={removeTask}
          onMoveTask={moveTask}
          onUpdateMapping={updateTaskMapping}
          onRemoveMapping={removeTaskMapping}
          onUpdateErrorBoundary={updateTaskErrorBoundary}
          onSyncTaskRef={syncTaskRef}
          onOpenPicker={() => setTaskPickerOpen(true)}
          onOpenCreator={() => setTaskPickerOpen(true)}
          canPickExisting={canPickExisting}
        />

        {/* Roles */}
        <TransitionRolesSection
          roles={startTransition.roles ?? []}
          onChange={updateRoles}
        />

        {/* Editable labels */}
        <Section title="Labels" count={labels.length} defaultOpen>
          <div className="space-y-2">
            {labels.map((l: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={l.language}
                  onChange={(e) => updateLabel(i, 'language', e.target.value)}
                  className="text-muted-foreground border-border bg-muted focus:ring-ring/20 w-10 shrink-0 rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] focus:ring-2 focus:outline-none"
                />
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => updateLabel(i, 'label', e.target.value)}
                  className="border-border bg-muted-surface text-foreground focus:ring-ring/20 focus:border-primary-border focus:bg-surface flex-1 rounded-lg border px-2.5 py-1.5 text-xs transition-all focus:ring-2 focus:outline-none"
                />
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => removeLabel(i)}
                        className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all"
                        aria-label="Remove label">
                        <Trash2 size={13} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-[11px]">
                      Remove label
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
            <button
              onClick={addLabel}
              className="text-secondary-icon hover:text-secondary-foreground mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
              <Plus size={13} /> Add Label
            </button>
          </div>
        </Section>
      </div>

      <ChooseExistingTaskDialog
        open={taskPickerOpen}
        onOpenChange={setTaskPickerOpen}
        onSelectTask={addTask}
      />
    </div>
  );
}
