import { resolveLabelOrKey, resolveLabel } from '../utils/label-resolver.js';
import {
  heading,
  bold,
  inlineCode,
  table,
  lines,
  callout,
} from '../utils/markdown-helpers.js';
import { buildStateDiagram } from '../utils/mermaid-builder.js';
import { buildFeatureMatrix } from '../utils/feature-matrix.js';
import {
  extractWorkflowDependencies,
  type WorkflowDependencyReport,
  type DependencyKind,
} from '../analysis/dependency-extractor.js';

interface LabelEntry {
  language: string;
  label: string;
}

interface Reference {
  key?: string;
  ref?: string;
  domain?: string;
  flow?: string;
  version?: string;
}

interface TaskExecution {
  _comment?: string;
  order?: number;
  task?: Reference;
  mapping?: unknown;
  errorBoundary?: unknown;
}

interface TransitionDef {
  _comment?: string;
  key: string;
  target?: string;
  triggerType?: number;
  triggerKind?: number;
  versionStrategy?: string;
  labels?: LabelEntry[];
  schema?: Reference | null;
  view?: { view?: Reference } | null;
  onExecutionTasks?: TaskExecution[];
  mapping?: unknown;
  roles?: { role: string; grant: string }[];
  rule?: unknown;
  timer?: unknown;
}

interface SubFlowDef {
  type?: string;
  process?: Reference;
  mapping?: unknown;
  viewOverrides?: Record<string, Reference>;
  overrides?: unknown;
}

interface StateDef {
  _comment?: string;
  key: string;
  stateType?: number;
  subType?: number;
  versionStrategy?: string;
  labels?: LabelEntry[];
  view?: { view?: Reference } | null;
  subFlow?: SubFlowDef | null;
  transitions?: TransitionDef[];
  onEntries?: TaskExecution[];
  onExits?: TaskExecution[];
  errorBoundary?: unknown;
  queryRoles?: { role: string; grant: string }[];
}

interface SharedTransitionDef extends TransitionDef {
  availableIn?: string[];
}

interface WorkflowJson {
  key?: string;
  _comment?: string;
  domain?: string;
  flow?: string;
  flowVersion?: string;
  version?: string;
  tags?: string[];
  attributes?: {
    type?: string;
    labels?: LabelEntry[];
    states?: StateDef[];
    startTransition?: TransitionDef;
    sharedTransitions?: SharedTransitionDef[];
    cancel?: TransitionDef | null;
    exit?: TransitionDef | null;
    updateData?: TransitionDef | null;
    timeout?: {
      _comment?: string;
      key?: string;
      target?: string;
      versionStrategy?: string;
      timer?: { reset?: string; duration?: string };
      mapping?: unknown;
    } | null;
    functions?: Reference[];
    extensions?: Reference[];
    features?: Reference[];
    schema?: { schema?: Reference } | null;
    errorBoundary?: unknown;
    queryRoles?: { role: string; grant: string }[];
  };
}

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  C: 'Core',
  F: 'Flow',
  S: 'SubFlow',
  P: 'Sub Process',
};

const STATE_TYPE_LABELS: Record<number, string> = {
  1: 'Initial',
  2: 'Intermediate',
  3: 'Final',
  4: 'SubFlow',
  5: 'Wizard',
};

const STATE_SUBTYPE_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Success',
  2: 'Error',
  3: 'Terminated',
  4: 'Suspended',
  5: 'Busy',
  6: 'Human',
};

const TRIGGER_TYPE_LABELS: Record<number, string> = {
  0: 'Manual',
  1: 'Automatic',
  2: 'Scheduled',
  3: 'Event',
};

function refDisplay(ref: Reference | undefined | null): string {
  if (!ref) return '-';
  if (ref.ref) return inlineCode(ref.ref);
  return inlineCode(ref.key ?? '?');
}

function taskRow(task: TaskExecution): string[] {
  return [
    String(task.order ?? '-'),
    refDisplay(task.task),
    task._comment ?? '-',
    task.errorBoundary ? 'Yes' : '-',
  ];
}

function buildTransitionSection(tr: TransitionDef, sourceState?: string): string {
  const label = resolveLabelOrKey(tr.labels, tr.key);
  const parts: string[] = [];

  parts.push(`${bold('Transition:')} ${label} (${inlineCode(tr.key)})`);
  if (tr._comment) parts.push(`${tr._comment}`);

  const meta: string[] = [];
  if (sourceState) meta.push(`Source: ${inlineCode(sourceState)}`);
  if (tr.target) meta.push(`Target: ${inlineCode(tr.target)}`);
  meta.push(`Trigger: ${TRIGGER_TYPE_LABELS[tr.triggerType ?? 0] ?? 'Manual'}`);
  if (tr.versionStrategy) meta.push(`Version Strategy: ${tr.versionStrategy}`);
  if (tr.schema) meta.push(`Schema: ${refDisplay(tr.schema)}`);
  if (tr.view?.view) meta.push(`View: ${refDisplay(tr.view.view)}`);

  parts.push(meta.join(' | '));

  if (tr.roles?.length) {
    const roleRows = tr.roles.map((r) => [inlineCode(r.role), r.grant]);
    parts.push(table(['Role', 'Grant'], roleRows));
  }

  if (tr.onExecutionTasks?.length) {
    parts.push(`${bold('Tasks:')}`);
    parts.push(
      table(
        ['Order', 'Task', 'Description', 'Error Boundary'],
        tr.onExecutionTasks.map(taskRow),
      ),
    );
  }

  return parts.join('\n\n');
}

function buildStateSection(state: StateDef): string {
  const label = resolveLabelOrKey(state.labels, state.key);
  const stateType = STATE_TYPE_LABELS[state.stateType ?? 2] ?? 'Intermediate';
  const subType =
    state.subType && state.subType !== 0
      ? ` / ${STATE_SUBTYPE_LABELS[state.subType] ?? 'Unknown'}`
      : '';

  const parts: string[] = [];
  parts.push(heading(3, `${label} (${inlineCode(state.key)})`));
  parts.push(`${bold('Type:')} ${stateType}${subType}`);
  if (state._comment) parts.push(state._comment);
  if (state.view?.view) parts.push(`${bold('View:')} ${refDisplay(state.view.view)}`);

  if (state.subFlow?.process) {
    const sf = state.subFlow;
    const sfType = sf.type === 'P' ? 'Sub Process' : 'SubFlow';
    parts.push(
      callout(
        `SubFlow Reference (${sfType})`,
        `Process: ${refDisplay(sf.process)}`,
      ),
    );
  }

  if (state.onEntries?.length) {
    parts.push(`${bold('On Entry Tasks:')}`);
    parts.push(
      table(
        ['Order', 'Task', 'Description', 'Error Boundary'],
        state.onEntries.map(taskRow),
      ),
    );
  }

  if (state.onExits?.length) {
    parts.push(`${bold('On Exit Tasks:')}`);
    parts.push(
      table(
        ['Order', 'Task', 'Description', 'Error Boundary'],
        state.onExits.map(taskRow),
      ),
    );
  }

  if (state.transitions?.length) {
    parts.push(heading(4, 'Transitions'));
    for (const tr of state.transitions) {
      parts.push(buildTransitionSection(tr, state.key));
      parts.push('---');
    }
  }

  if (state.queryRoles?.length) {
    parts.push(`${bold('Query Roles:')}`);
    const roleRows = state.queryRoles.map((r) => [inlineCode(r.role), r.grant]);
    parts.push(table(['Role', 'Grant'], roleRows));
  }

  return parts.join('\n\n');
}

const DEPENDENCY_KIND_LABELS: Record<DependencyKind, string> = {
  task: 'Tasks',
  view: 'Views',
  subflow: 'Subflows',
  function: 'Functions',
  extension: 'Extensions',
  schema: 'Schemas',
};

const DEPENDENCY_KIND_ORDER: DependencyKind[] = [
  'task',
  'view',
  'subflow',
  'function',
  'extension',
  'schema',
];

function buildDependencyTreeSection(report: WorkflowDependencyReport): string | null {
  if (report.refs.length === 0) return null;

  const parts: string[] = [];
  parts.push(heading(2, 'Dependency Tree'));

  const crossDomainRefs = report.refs.filter((r) => r.crossDomain);
  if (crossDomainRefs.length > 0) {
    const externalDomains = [...new Set(crossDomainRefs.map((r) => r.domain))].sort();
    parts.push(
      callout(
        'Cross-Domain Dependencies',
        `This workflow references ${crossDomainRefs.length} component(s) from external domain(s): ${externalDomains.map((d) => inlineCode(d)).join(', ')}`,
      ),
    );
  }

  const grouped = new Map<DependencyKind, typeof report.refs>();
  for (const ref of report.refs) {
    const list = grouped.get(ref.kind) ?? [];
    list.push(ref);
    grouped.set(ref.kind, list);
  }

  for (const kind of DEPENDENCY_KIND_ORDER) {
    const refs = grouped.get(kind);
    if (!refs?.length) continue;

    // Deduplicate by (key, domain, flow, version) for the table display
    const seen = new Set<string>();
    const unique = refs.filter((r) => {
      const id = `${r.key}|${r.domain}|${r.flow}|${r.version}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    parts.push(heading(3, DEPENDENCY_KIND_LABELS[kind]));
    const rows = unique.map((r) => [
      inlineCode(r.key),
      r.domain || '-',
      r.version || '-',
      r.crossDomain ? 'Yes' : '-',
      r.sourcePath,
    ]);
    parts.push(table(['Key', 'Domain', 'Version', 'Cross-domain', 'Source'], rows));
  }

  return parts.join('\n\n');
}

export function generateWorkflowMarkdown(workflowJson: unknown): string {
  const wf = workflowJson as WorkflowJson;
  const attrs = wf.attributes;
  const title = resolveLabelOrKey(attrs?.labels, wf.key ?? 'Workflow');
  const wfType = WORKFLOW_TYPE_LABELS[attrs?.type ?? ''] ?? attrs?.type ?? '-';

  const sections: (string | null | undefined | false)[] = [];

  sections.push(heading(1, title));

  if (wf._comment) {
    sections.push(wf._comment);
  }

  sections.push(heading(2, 'Metadata'));
  sections.push(
    table(
      ['Property', 'Value'],
      [
        ['Key', inlineCode(wf.key ?? '-')],
        ['Domain', inlineCode(wf.domain ?? '-')],
        ['Flow', inlineCode(wf.flow ?? '-')],
        ['Version', wf.version ?? '-'],
        ['Flow Version', wf.flowVersion ?? '-'],
        ['Type', wfType],
        ['Tags', wf.tags?.length ? wf.tags.map((t) => inlineCode(t)).join(', ') : '-'],
      ],
    ),
  );

  const diagram = buildStateDiagram(workflowJson);
  if (diagram) {
    sections.push(heading(2, 'State Lifecycle'));
    sections.push(`\`\`\`mermaid\n${diagram}\n\`\`\``);
  }

  sections.push(heading(2, 'Feature Matrix'));
  sections.push(buildFeatureMatrix(attrs));

  const depReport = extractWorkflowDependencies(workflowJson);
  const depSection = buildDependencyTreeSection(depReport);
  if (depSection) {
    sections.push(depSection);
  }

  if (attrs?.startTransition) {
    sections.push(heading(2, 'Start Transition'));
    sections.push(buildTransitionSection(attrs.startTransition));
  }

  if (attrs?.states?.length) {
    sections.push(heading(2, 'States'));
    for (const state of attrs.states) {
      sections.push(buildStateSection(state));
    }
  }

  if (attrs?.sharedTransitions?.length) {
    sections.push(heading(2, 'Shared Transitions'));
    for (const st of attrs.sharedTransitions) {
      const label = resolveLabelOrKey(st.labels, st.key);
      const parts: string[] = [heading(3, `${label} (${inlineCode(st.key)})`)];
      if (st._comment) parts.push(st._comment);
      if (st.availableIn?.length) {
        parts.push(
          `${bold('Available In:')} ${st.availableIn.map((s) => inlineCode(s)).join(', ')}`,
        );
      }
      parts.push(buildTransitionSection(st));
      sections.push(parts.join('\n\n'));
    }
  }

  if (attrs?.cancel) {
    sections.push(heading(2, 'Cancel Transition'));
    sections.push(buildTransitionSection(attrs.cancel));
  }

  if (attrs?.exit) {
    sections.push(heading(2, 'Exit Transition'));
    sections.push(buildTransitionSection(attrs.exit));
  }

  if (attrs?.updateData) {
    sections.push(heading(2, 'Update Data Transition'));
    sections.push(buildTransitionSection(attrs.updateData));
  }

  if (attrs?.timeout) {
    sections.push(heading(2, 'Timeout'));
    const to = attrs.timeout;
    const toParts = [
      `${bold('Key:')} ${inlineCode(to.key ?? '-')}`,
      `${bold('Target:')} ${inlineCode(to.target ?? '-')}`,
    ];
    if (to.timer?.duration) toParts.push(`${bold('Duration:')} ${to.timer.duration}`);
    if (to.timer?.reset) toParts.push(`${bold('Reset:')} ${to.timer.reset}`);
    if (to._comment) toParts.push(to._comment);
    sections.push(toParts.join('\n\n'));
  }

  sections.push(
    `\n---\n*Generated by vNext Forge*`,
  );

  return lines(...sections);
}
