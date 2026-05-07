export type DependencyKind =
  | 'view'
  | 'task'
  | 'subflow'
  | 'function'
  | 'extension'
  | 'schema';

export interface DependencyRef {
  kind: DependencyKind;
  key: string;
  domain: string;
  flow: string;
  version: string;
  crossDomain: boolean;
  sourcePath: string;
}

export interface WorkflowDependencyReport {
  workflowKey: string;
  workflowDomain: string;
  refs: DependencyRef[];
}

export interface FlowEdge {
  sourceKey: string;
  sourceDomain: string;
  targetKey: string;
  targetDomain: string;
  edgeType: 'subflow' | 'task-trigger';
}

export interface ProjectDependencyGraph {
  workflows: WorkflowDependencyReport[];
  flowEdges: FlowEdge[];
}

// ---------------------------------------------------------------------------
// Internal JSON shapes (mirrors workflow-doc.ts conventions)
// ---------------------------------------------------------------------------

interface Ref {
  key?: string;
  ref?: string;
  domain?: string;
  flow?: string;
  version?: string;
}

interface TaskExec {
  task?: Ref;
}

interface TransitionShape {
  key?: string;
  schema?: Ref | null;
  view?: { view?: Ref } | null;
  views?: Array<{ view?: Ref }> | null;
  onExecutionTasks?: TaskExec[];
}

interface SubFlowShape {
  type?: string;
  process?: Ref;
  viewOverrides?: Record<string, Ref>;
}

interface StateShape {
  key?: string;
  view?: { view?: Ref } | null;
  views?: Array<{ view?: Ref }> | null;
  subFlow?: SubFlowShape | null;
  transitions?: TransitionShape[];
  onEntries?: TaskExec[];
  onExits?: TaskExec[];
}

interface WorkflowShape {
  key?: string;
  domain?: string;
  attributes?: {
    startTransition?: TransitionShape;
    states?: StateShape[];
    sharedTransitions?: TransitionShape[];
    cancel?: TransitionShape | null;
    exit?: TransitionShape | null;
    updateData?: TransitionShape | null;
    functions?: Ref[];
    extensions?: Ref[];
    features?: Ref[];
    schema?: { schema?: Ref } | null;
  };
}

interface TaskJsonShape {
  key?: string;
  domain?: string;
  attributes?: {
    type?: string;
    config?: Record<string, unknown>;
  };
}

const TRIGGER_TASK_TYPES = new Set([
  'start',
  'direct-trigger',
  'sub-process',
  'get-instances',
  'get-instance-data',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveKey(ref: Ref | undefined | null): string {
  if (!ref) return '';
  return ref.ref ?? ref.key ?? '';
}

function pushRef(
  out: DependencyRef[],
  kind: DependencyKind,
  ref: Ref | undefined | null,
  wfDomain: string,
  sourcePath: string,
): void {
  if (!ref) return;
  const key = resolveKey(ref);
  if (!key) return;
  const domain = ref.domain ?? '';
  out.push({
    kind,
    key,
    domain,
    flow: ref.flow ?? '',
    version: ref.version ?? '',
    crossDomain: domain !== '' && domain !== wfDomain,
    sourcePath,
  });
}

function collectTransitionRefs(
  out: DependencyRef[],
  tr: TransitionShape | undefined | null,
  wfDomain: string,
  pathPrefix: string,
): void {
  if (!tr) return;
  pushRef(out, 'schema', tr.schema, wfDomain, `${pathPrefix}.schema`);
  pushRef(out, 'view', tr.view?.view, wfDomain, `${pathPrefix}.view`);
  if (tr.views) {
    for (let i = 0; i < tr.views.length; i++) {
      pushRef(out, 'view', tr.views[i]?.view, wfDomain, `${pathPrefix}.views[${i}]`);
    }
  }
  if (tr.onExecutionTasks) {
    for (let i = 0; i < tr.onExecutionTasks.length; i++) {
      pushRef(
        out,
        'task',
        tr.onExecutionTasks[i]?.task,
        wfDomain,
        `${pathPrefix}.onExecutionTasks[${i}]`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function extractWorkflowDependencies(
  workflowJson: unknown,
): WorkflowDependencyReport {
  const wf = workflowJson as WorkflowShape;
  const wfKey = wf.key ?? '';
  const wfDomain = wf.domain ?? '';
  const attrs = wf.attributes;
  const refs: DependencyRef[] = [];

  if (!attrs) return { workflowKey: wfKey, workflowDomain: wfDomain, refs };

  // Top-level functions / extensions / features
  for (const r of attrs.functions ?? []) {
    pushRef(refs, 'function', r, wfDomain, 'attributes.functions');
  }
  for (const r of attrs.extensions ?? []) {
    pushRef(refs, 'extension', r, wfDomain, 'attributes.extensions');
  }
  for (const r of attrs.features ?? []) {
    pushRef(refs, 'extension', r, wfDomain, 'attributes.features');
  }

  // Master schema
  pushRef(refs, 'schema', attrs.schema?.schema, wfDomain, 'attributes.schema');

  // Start transition
  collectTransitionRefs(refs, attrs.startTransition, wfDomain, 'startTransition');

  // States
  for (const state of attrs.states ?? []) {
    const sp = `states[${state.key ?? '?'}]`;

    // State-level views
    pushRef(refs, 'view', state.view?.view, wfDomain, `${sp}.view`);
    if (state.views) {
      for (let i = 0; i < state.views.length; i++) {
        pushRef(refs, 'view', state.views[i]?.view, wfDomain, `${sp}.views[${i}]`);
      }
    }

    // SubFlow
    if (state.subFlow?.process) {
      pushRef(refs, 'subflow', state.subFlow.process, wfDomain, `${sp}.subFlow`);

      // SubFlow view overrides
      if (state.subFlow.viewOverrides) {
        for (const [overrideKey, overrideRef] of Object.entries(state.subFlow.viewOverrides)) {
          pushRef(refs, 'view', overrideRef, wfDomain, `${sp}.subFlow.viewOverrides[${overrideKey}]`);
        }
      }
    }

    // On-entry / on-exit tasks
    for (let i = 0; i < (state.onEntries?.length ?? 0); i++) {
      pushRef(refs, 'task', state.onEntries![i]?.task, wfDomain, `${sp}.onEntries[${i}]`);
    }
    for (let i = 0; i < (state.onExits?.length ?? 0); i++) {
      pushRef(refs, 'task', state.onExits![i]?.task, wfDomain, `${sp}.onExits[${i}]`);
    }

    // State transitions
    for (const tr of state.transitions ?? []) {
      collectTransitionRefs(
        refs,
        tr,
        wfDomain,
        `${sp}.transitions[${tr.key ?? '?'}]`,
      );
    }
  }

  // Shared transitions
  for (const st of attrs.sharedTransitions ?? []) {
    collectTransitionRefs(
      refs,
      st,
      wfDomain,
      `sharedTransitions[${st.key ?? '?'}]`,
    );
  }

  // Cancel / exit / updateData
  collectTransitionRefs(refs, attrs.cancel, wfDomain, 'cancel');
  collectTransitionRefs(refs, attrs.exit, wfDomain, 'exit');
  collectTransitionRefs(refs, attrs.updateData, wfDomain, 'updateData');

  return { workflowKey: wfKey, workflowDomain: wfDomain, refs };
}

/**
 * Extracts a workflow-to-workflow edge from a task JSON that triggers another
 * workflow (e.g. start, direct-trigger, sub-process task types).
 *
 * The calling workflow's identity must be supplied separately because the task
 * JSON itself doesn't know which workflow uses it.
 */
export function extractTaskWorkflowTriggers(
  taskJson: unknown,
): FlowEdge | null {
  const task = taskJson as TaskJsonShape;
  const taskType = task.attributes?.type?.toLowerCase() ?? '';
  if (!TRIGGER_TASK_TYPES.has(taskType)) return null;

  const config = task.attributes?.config;
  if (!config) return null;

  const triggerDomain = config.triggerDomain as string | undefined;
  const triggerFlow = config.triggerFlow as string | undefined;

  if (!triggerDomain || !triggerFlow) return null;

  return {
    sourceKey: '',
    sourceDomain: task.domain ?? '',
    targetKey: triggerFlow,
    targetDomain: triggerDomain,
    edgeType: 'task-trigger',
  };
}

export function aggregateProjectGraph(
  reports: WorkflowDependencyReport[],
  taskEdges: FlowEdge[],
): ProjectDependencyGraph {
  const flowEdges: FlowEdge[] = [];

  // Subflow edges derived from workflow dependency reports
  for (const report of reports) {
    for (const ref of report.refs) {
      if (ref.kind === 'subflow') {
        flowEdges.push({
          sourceKey: report.workflowKey,
          sourceDomain: report.workflowDomain,
          targetKey: ref.key,
          targetDomain: ref.domain,
          edgeType: 'subflow',
        });
      }
    }
  }

  // Task-trigger edges (deduplicated)
  const edgeSet = new Set(
    flowEdges.map((e) => `${e.sourceDomain}|${e.sourceKey}|${e.targetDomain}|${e.targetKey}|${e.edgeType}`),
  );

  for (const te of taskEdges) {
    const id = `${te.sourceDomain}|${te.sourceKey}|${te.targetDomain}|${te.targetKey}|${te.edgeType}`;
    if (!edgeSet.has(id)) {
      edgeSet.add(id);
      flowEdges.push(te);
    }
  }

  return { workflows: reports, flowEdges };
}
