import { useCallback, useMemo } from 'react';
import type { Label, TaskExecution, ViewBinding, ErrorBoundary } from '@vnext-forge/vnext-types';
import type { RoleGrant } from '@vnext-forge/vnext-types';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import type { ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import type { SchemaReference } from '../../../../../../modules/save-component/components/SchemaReferenceField';
import type { AtomicSavedInfo } from '../../../../../../modules/save-component/componentEditorModalTypes.js';
import { useWorkflowStore } from '../../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../../store/useProjectStore';

export type FindTransition = (draft: any) => { container: any; transitions: any[] } | null;

export interface TransitionMutations {
  updateTransition: (index: number, field: string, value: unknown) => void;
  updateTransitionScript: (index: number, scriptField: 'rule' | 'condition' | 'timer', script: ScriptCode) => void;
  removeTransitionScript: (index: number, scriptField: 'rule' | 'condition' | 'timer') => void;
  updateTransitionSchema: (index: number, schema: SchemaReference | null) => void;
  updateTransitionMapping: (index: number, mapping: ScriptCode) => void;
  removeTransitionMapping: (index: number) => void;
  updateTransitionRoles: (index: number, roles: RoleGrant[]) => void;
  updateTransitionView: (index: number, view: ViewBinding | null) => void;
  updateTransitionViews: (index: number, views: ViewBinding[]) => void;
  updateTransitionLabels: (index: number, labels: Label[]) => void;
  addTask: (transitionIndex: number, task: DiscoveredVnextComponent) => void;
  removeTask: (transitionIndex: number, taskIndex: number) => void;
  moveTask: (transitionIndex: number, fromIndex: number, toIndex: number) => void;
  updateTaskMapping: (transitionIndex: number, taskIndex: number, mapping: ScriptCode) => void;
  removeTaskMapping: (transitionIndex: number, taskIndex: number) => void;
  updateTaskErrorBoundary: (transitionIndex: number, taskIndex: number, eb: ErrorBoundary | undefined) => void;
  syncTaskRef: (transitionIndex: number, taskIndex: number, next: AtomicSavedInfo) => void;
  allStateKeys: string[];
  canPickExisting: boolean;
  projectDomain: string;
}

/**
 * Index-parameterized mutation factories for transition editing.
 *
 * `findTransition` locates the transition container in the Immer draft:
 * - For the state panel: returns `{ container: stateObj, transitions: stateObj.transitions }`
 * - For the edge panel: same logic but resolved via `parseEdgeId`
 */
export function useTransitionMutations(findTransition: FindTransition): TransitionMutations {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);

  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  const allStateKeys = useMemo(() => {
    type Attrs = { states?: Array<{ key: string }> };
    const attrs = workflowJson?.attributes as Attrs | undefined;
    return (attrs?.states || []).map((s) => s.key);
  }, [workflowJson]);

  const updateTransition = useCallback((index: number, field: string, value: unknown) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      ctx.transitions[index][field] = value;
    });
  }, [updateWorkflow, findTransition]);

  const updateTransitionScript = useCallback((
    index: number,
    scriptField: 'rule' | 'condition' | 'timer',
    script: ScriptCode,
  ) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      ctx.transitions[index][scriptField] = script;
      if (scriptField === 'rule') ctx.transitions[index].condition = script;
      else if (scriptField === 'condition') ctx.transitions[index].rule = script;
    });
  }, [updateWorkflow, findTransition]);

  const removeTransitionScript = useCallback((
    index: number,
    scriptField: 'rule' | 'condition' | 'timer',
  ) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      delete ctx.transitions[index][scriptField];
      if (scriptField === 'rule') delete ctx.transitions[index].condition;
      if (scriptField === 'condition') delete ctx.transitions[index].rule;
    });
  }, [updateWorkflow, findTransition]);

  const updateTransitionSchema = useCallback((index: number, schema: SchemaReference | null) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      ctx.transitions[index].schema = schema;
    });
  }, [updateWorkflow, findTransition]);

  const updateTransitionMapping = useCallback((index: number, mapping: ScriptCode) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      ctx.transitions[index].mapping = mapping;
    });
  }, [updateWorkflow, findTransition]);

  const removeTransitionMapping = useCallback((index: number) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      delete ctx.transitions[index].mapping;
    });
  }, [updateWorkflow, findTransition]);

  const updateTransitionRoles = useCallback((index: number, roles: RoleGrant[]) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      ctx.transitions[index].roles = roles.length > 0 ? roles : undefined;
    });
  }, [updateWorkflow, findTransition]);

  const updateTransitionView = useCallback((index: number, view: ViewBinding | null) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      if (view) {
        ctx.transitions[index].view = view;
        delete ctx.transitions[index].views;
      } else {
        delete ctx.transitions[index].view;
      }
    });
  }, [updateWorkflow, findTransition]);

  const updateTransitionViews = useCallback((index: number, views: ViewBinding[]) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      if (views.length > 0) {
        ctx.transitions[index].views = views;
        delete ctx.transitions[index].view;
      } else {
        delete ctx.transitions[index].views;
      }
    });
  }, [updateWorkflow, findTransition]);

  const updateTransitionLabels = useCallback((index: number, labels: Label[]) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[index]) return;
      ctx.transitions[index].labels = labels;
    });
  }, [updateWorkflow, findTransition]);

  const addTask = useCallback((transitionIndex: number, task: DiscoveredVnextComponent) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions?.[transitionIndex]) return;
      if (!ctx.transitions[transitionIndex].onExecutionTasks) {
        ctx.transitions[transitionIndex].onExecutionTasks = [];
      }
      const tasks: TaskExecution[] = ctx.transitions[transitionIndex].onExecutionTasks;
      tasks.push({
        order: tasks.length + 1,
        task: {
          key: task.key,
          domain: projectDomain,
          version: task.version || '1.0.0',
          flow: task.flow,
        },
      });
    });
  }, [updateWorkflow, findTransition, projectDomain]);

  const removeTask = useCallback((transitionIndex: number, taskIndex: number) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      const tasks = ctx?.transitions?.[transitionIndex]?.onExecutionTasks;
      if (!tasks) return;
      tasks.splice(taskIndex, 1);
      tasks.forEach((t: any, i: number) => { t.order = i + 1; });
    });
  }, [updateWorkflow, findTransition]);

  const moveTask = useCallback((transitionIndex: number, fromIndex: number, toIndex: number) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      const tasks = ctx?.transitions?.[transitionIndex]?.onExecutionTasks;
      if (!tasks || toIndex < 0 || toIndex >= tasks.length) return;
      const [item] = tasks.splice(fromIndex, 1);
      tasks.splice(toIndex, 0, item);
      tasks.forEach((t: any, i: number) => { t.order = i + 1; });
    });
  }, [updateWorkflow, findTransition]);

  const updateTaskMapping = useCallback((
    transitionIndex: number,
    taskIndex: number,
    mapping: ScriptCode,
  ) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      const entry = ctx?.transitions?.[transitionIndex]?.onExecutionTasks?.[taskIndex];
      if (!entry) return;
      entry.mapping = mapping;
    });
  }, [updateWorkflow, findTransition]);

  const removeTaskMapping = useCallback((transitionIndex: number, taskIndex: number) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      const entry = ctx?.transitions?.[transitionIndex]?.onExecutionTasks?.[taskIndex];
      if (!entry) return;
      delete entry.mapping;
    });
  }, [updateWorkflow, findTransition]);

  const updateTaskErrorBoundary = useCallback((
    transitionIndex: number,
    taskIndex: number,
    eb: ErrorBoundary | undefined,
  ) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      const entry = ctx?.transitions?.[transitionIndex]?.onExecutionTasks?.[taskIndex];
      if (!entry) return;
      if (eb) {
        entry.errorBoundary = eb;
      } else {
        delete entry.errorBoundary;
      }
    });
  }, [updateWorkflow, findTransition]);

  const syncTaskRef = useCallback((
    transitionIndex: number,
    taskIndex: number,
    next: AtomicSavedInfo,
  ) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      const entry = ctx?.transitions?.[transitionIndex]?.onExecutionTasks?.[taskIndex];
      if (!entry) return;
      if (!entry.task) entry.task = {};
      entry.task.key = next.key;
      entry.task.version = next.version;
      entry.task.domain = next.domain;
      entry.task.flow = next.flow;
    });
  }, [updateWorkflow, findTransition]);

  return {
    updateTransition,
    updateTransitionScript,
    removeTransitionScript,
    updateTransitionSchema,
    updateTransitionMapping,
    removeTransitionMapping,
    updateTransitionRoles,
    updateTransitionView,
    updateTransitionViews,
    updateTransitionLabels,
    addTask,
    removeTask,
    moveTask,
    updateTaskMapping,
    removeTaskMapping,
    updateTaskErrorBoundary,
    syncTaskRef,
    allStateKeys,
    canPickExisting,
    projectDomain,
  };
}
