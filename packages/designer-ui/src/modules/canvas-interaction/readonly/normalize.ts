import type {
  ComponentRef,
  CodeView,
  LabelView,
  RoleGrantView,
  TaskRefView,
  TransitionView,
  ViewBindingView,
  StateView,
  WorkflowMetaView,
  WorkflowViewModel,
} from './view-types';

export function normalizeTriggerType(t: unknown): number {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    switch (t.toLowerCase()) {
      case 'manual': return 0;
      case 'automatic': case 'auto': return 1;
      case 'scheduled': case 'timer': return 2;
      case 'event': return 3;
    }
  }
  return 0;
}

// ── FlowCanvas JSON (ported from monitoring; single source now) ───────────────
export function toFlowCanvasJson(item: Record<string, unknown>): Record<string, unknown> {
  const raw = item as any;

  // Case 1: Full vNext format — pass through unchanged.
  if (Array.isArray(raw.attributes?.states)) {
    return item;
  }

  // Case 2: Monitoring semi-flat — states at top level with nested transitions.
  if (Array.isArray(raw.states) && (raw.states.length === 0 || Array.isArray(raw.states[0]?.transitions))) {
    const states: any[] = raw.states;
    const initialState = states.find((s: any) => (s.stateType ?? s.type) === 1);
    const startTransition = initialState
      ? { key: '__start_transition__', target: initialState.key, triggerType: 0 }
      : undefined;

    const wfLevel = (k: string) =>
      raw[k]
        ? { [k]: { key: raw[k].key, target: raw[k].target ?? raw[k].to ?? '', availableIn: raw[k].availableIn ?? [] } }
        : {};

    return {
      key: raw.key,
      attributes: {
        startTransition,
        states: states.map((s: any) => ({
          key: s.key,
          stateType: s.stateType ?? s.type ?? 2,
          labels: s.labels,
          transitions: (s.transitions ?? []).map((t: any) => ({
            key: t.key,
            target: t.target ?? t.to ?? '',
            triggerType: normalizeTriggerType(t.triggerType),
            triggerKind: normalizeTriggerType(t.triggerKind),
            labels: t.labels,
          })),
          onEntries: s.onEntries ?? [],
          onExits: s.onExits ?? [],
          view: s.view,
          errorBoundary: s.errorBoundary,
          subFlow: s.subFlow,
        })),
        ...wfLevel('cancel'),
        ...wfLevel('timeout'),
        ...wfLevel('updateData'),
        ...wfLevel('exit'),
      },
    };
  }

  // Case 3: Fully flat — separate top-level states[] and transitions[].
  const states = (raw.states ?? []) as any[];
  const transitions = (raw.transitions ?? []) as any[];
  const initialState = states.find((s) => s.type === 1);
  const startTransition = initialState
    ? { key: '__start_transition__', target: initialState.key, triggerType: 0 }
    : undefined;

  const transitionsByState = new Map<string, unknown[]>();
  for (const t of transitions) {
    const list = transitionsByState.get(t.from) ?? [];
    list.push({ key: t.key, target: t.to, triggerType: t.triggerType ?? 0 });
    transitionsByState.set(t.from, list);
  }

  return {
    key: raw.key,
    attributes: {
      startTransition,
      states: states.map((s) => ({
        key: s.key,
        stateType: s.type,
        labels: s.labels,
        transitions: transitionsByState.get(s.key) ?? [],
      })),
    },
  };
}

// ── View-model extraction ─────────────────────────────────────────────────────
function asLabels(v: any): LabelView[] | undefined {
  const arr = v?.labels ?? v?.label;
  if (!Array.isArray(arr)) return undefined;
  return arr.map((l: any) => ({ language: l.language ?? '', label: l.label ?? '' }));
}

function asRef(v: any): ComponentRef | null {
  if (!v || typeof v !== 'object') return null;
  if (!v.key) return null;
  return { key: v.key, domain: v.domain, version: v.version, flow: v.flow };
}

function asCode(v: any): CodeView | null {
  if (!v || typeof v !== 'object') return null;
  if (v.code == null && v.location == null) return null;
  return { code: typeof v.code === 'string' ? v.code : undefined, location: v.location };
}

function asRoles(v: any): RoleGrantView[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((r: any) =>
    typeof r === 'string' ? { role: r } : { role: r.role ?? r.key ?? '', grant: r.grant },
  );
}

function asViewBinding(v: any): ViewBindingView | null {
  if (!v || typeof v !== 'object') return null;
  const ref = asRef(v.view ?? v);
  if (!ref) return null;
  return { view: ref, loadData: v.loadData, extensions: v.extensions };
}

function asViewBindings(v: any): ViewBindingView[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map(asViewBinding).filter(Boolean) as ViewBindingView[];
}

function asTasks(v: any): TaskRefView[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((e: any) => {
    const ref = asRef(e.task ?? e) ?? { key: '' };
    return {
      order: e.order,
      ref,
      comment: e._comment,
      mapping: asCode(e.mapping),
      hasErrorBoundary: Boolean(e.errorBoundary),
    };
  });
}

function toTransitionView(t: any, from: string, isStart = false): TransitionView {
  return {
    key: t.key ?? '',
    from,
    target: t.target ?? t.to ?? '',
    triggerType: t.triggerType != null ? normalizeTriggerType(t.triggerType) : undefined,
    triggerKind: t.triggerKind != null ? normalizeTriggerType(t.triggerKind) : undefined,
    comment: t._comment,
    labels: asLabels(t),
    roles: asRoles(t.roles),
    tasks: asTasks(t.onExecutionTasks),
    schema: asRef(t.schema),
    mapping: asCode(t.mapping),
    rule: asCode(t.rule),
    timer: asCode(t.timer),
    view: asViewBinding(t.view),
    views: asViewBindings(t.views),
    availableIn: Array.isArray(t.availableIn) ? t.availableIn : undefined,
    annotations: t.annotations && typeof t.annotations === 'object' ? t.annotations : undefined,
    isStart,
  };
}

function toStateView(s: any, flatTransitions?: any[]): StateView {
  const key = s.key;
  const stateType = s.stateType ?? s.type ?? 2;
  let transitions: TransitionView[];
  if (Array.isArray(s.transitions)) {
    transitions = s.transitions.map((t: any) => toTransitionView(t, key));
  } else if (flatTransitions) {
    transitions = flatTransitions.filter((t) => t.from === key).map((t) => toTransitionView(t, key));
  } else {
    transitions = [];
  }
  const onError = s.errorBoundary?.onError;
  return {
    key,
    stateType,
    subType: typeof s.subType === 'number' ? s.subType : undefined,
    labels: asLabels(s),
    comment: s._comment,
    versionStrategy: s.versionStrategy,
    queryRoles: asRoles(s.queryRoles),
    view: asViewBinding(s.view),
    views: asViewBindings(s.views),
    onEntries: asTasks(s.onEntries),
    onExits: asTasks(s.onExits),
    transitions,
    errorHandlers: Array.isArray(onError)
      ? onError.map((h: any) => ({ target: h.target ?? h.to, comment: h._comment }))
      : undefined,
    subFlowProcess: asRef(s.subFlow?.process ?? s.subFlow?.processRef),
    subFlowMapping: asCode(s.subFlow?.mapping),
  };
}

function wfTransition(raw: any, k: string): TransitionView | null {
  const v = raw[k];
  if (!v) return null;
  const tv = toTransitionView(v, '');
  return tv;
}

export function normalizeDefinition(raw: Record<string, unknown>): WorkflowViewModel {
  const r = raw as any;
  const attrs = r.attributes;

  // States: prefer attributes.states (full vNext), else top-level states.
  const rawStates: any[] = Array.isArray(attrs?.states) ? attrs.states : (r.states ?? []);
  const flatTransitions: any[] | undefined =
    !Array.isArray(attrs?.states) && Array.isArray(r.transitions) && !Array.isArray(rawStates[0]?.transitions)
      ? r.transitions
      : undefined;
  const states = rawStates.map((s) => toStateView(s, flatTransitions));

  const metaSrc = attrs ?? r;
  const workflow: WorkflowMetaView = {
    key: r.key ?? '',
    domain: r.domain,
    version: r.version,
    flow: r.flow,
    type: typeof r.type === 'string' ? r.type : undefined,
    tags: Array.isArray(r.tags) ? r.tags : undefined,
    comment: r._comment,
    labels: asLabels(r),
    schema: asRef(metaSrc.schema),
    functions: Array.isArray(metaSrc.functions)
      ? (metaSrc.functions.map(asRef).filter(Boolean) as ComponentRef[])
      : undefined,
    extensions: Array.isArray(metaSrc.extensions)
      ? (metaSrc.extensions.map(asRef).filter(Boolean) as ComponentRef[])
      : undefined,
    queryRoles: asRoles(metaSrc.queryRoles),
    cancel: wfTransition(metaSrc, 'cancel'),
    exit: wfTransition(metaSrc, 'exit'),
    timeout: wfTransition(metaSrc, 'timeout'),
    updateData: wfTransition(metaSrc, 'updateData'),
    sharedTransitions: Array.isArray(metaSrc.sharedTransitions)
      ? metaSrc.sharedTransitions.map((t: any) => toTransitionView(t, ''))
      : undefined,
  };

  return { workflowJson: toFlowCanvasJson(raw), workflow, states };
}

export function findState(vm: WorkflowViewModel, key: string): StateView | null {
  return vm.states.find((s) => s.key === key) ?? null;
}

export function findTransition(vm: WorkflowViewModel, key: string): TransitionView | null {
  for (const s of vm.states) {
    const t = s.transitions.find((tr) => tr.key === key);
    if (t) return t;
  }
  const wf = vm.workflow;
  for (const t of [wf.cancel, wf.exit, wf.timeout, wf.updateData, ...(wf.sharedTransitions ?? [])]) {
    if (t && t.key === key) return t;
  }
  return null;
}
