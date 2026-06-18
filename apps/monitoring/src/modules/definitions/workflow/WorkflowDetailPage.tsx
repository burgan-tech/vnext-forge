import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button } from '@vnext-forge-studio/designer-ui/ui';
import { config } from '@monitoring/shared/config/config';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { StateDistributionChart, type ChartType } from '@monitoring/modules/definitions/components/StateDistributionChart';
import {
  useWorkflowDetail,
  useWorkflowVersions,
  useWorkflowStats,
  useWorkflowStateDistribution,
  useWorkflowPermissionMatrix,
  useWorkflowDependencies,
  useWorkflowDefinitionDetail,
} from '@monitoring/modules/definitions/api/definitions-queries';
import { useInstanceList } from '@monitoring/modules/instances/api/instances-queries';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
import type { InstanceStatus } from '@monitoring/shared/types';
import type { WorkflowDefState, WorkflowDefTransition } from '@monitoring/shared/types/definitions-api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOW_TYPE_LABELS: Record<string, string> = { F: 'Flow', S: 'State', P: 'Process' };
const WORKFLOW_TYPE_VARIANTS: Record<string, 'info' | 'warning' | 'secondary'> = {
  F: 'info', S: 'warning', P: 'secondary',
};

type Tab = 'overview' | 'definition' | 'instances' | 'related' | 'permissions';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Graph' },
  { id: 'instances', label: 'Instances' },
  { id: 'related', label: 'Related' },
  { id: 'permissions', label: 'Permissions' },
];

const STATUS_OPTIONS: Array<{ label: string; value: InstanceStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'Active' },
  { label: 'Busy', value: 'Busy' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Faulted', value: 'Faulted' },
  { label: 'Suspended', value: 'Suspended' },
];

// State type codes from vNext schema
const STATE_TYPE_LABELS: Record<number, string> = {
  1: 'Initial', 2: 'Intermediate', 3: 'Finish', 4: 'SubFlow', 5: 'Wizard',
};

const TRIGGER_TYPE_LABELS: Record<number, string> = {
  0: 'Manual', 1: 'Auto', 2: 'Scheduled', 3: 'Event',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CODE_MAP: Record<string, InstanceStatus> = {
  A: 'Active', B: 'Busy', C: 'Completed', F: 'Faulted', S: 'Suspended', T: 'Terminated',
};

function resolveStatus(rawStatus: string | undefined, metaStatus: string | undefined): InstanceStatus {
  if (rawStatus && rawStatus.length > 1) return rawStatus as InstanceStatus;
  const code = metaStatus ?? rawStatus ?? '';
  return STATUS_CODE_MAP[code] ?? 'Active';
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDuration(createdAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function pct(v: number, max: number): number {
  return max > 0 ? Math.round((v / max) * 100) : 0;
}

// ---------------------------------------------------------------------------
// WorkflowStateGraph — visual definition view
// ---------------------------------------------------------------------------

function stateTypeColor(type: number): string {
  switch (type) {
    case 1: return 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
    case 3: return 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200';
    case 4: return 'border-purple-500 bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200';
    case 5: return 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200';
    default: return 'border-border bg-card text-foreground';
  }
}

function triggerBadgeVariant(t: number): 'secondary' | 'info' | 'warning' | 'muted' {
  switch (t) {
    case 1: return 'info';
    case 2: return 'warning';
    default: return 'secondary';
  }
}

interface WorkflowStateGraphProps {
  states: WorkflowDefState[];
  transitions: WorkflowDefTransition[];
}

function WorkflowStateGraph({ states, transitions }: WorkflowStateGraphProps) {
  // Compute tier by BFS from initial states
  const tierMap = new Map<string, number>();
  const queue: string[] = [];

  states.filter((s) => s.type === 1).forEach((s) => {
    tierMap.set(s.key, 0);
    queue.push(s.key);
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentTier = tierMap.get(current) ?? 0;
    transitions
      .filter((t) => t.from === current)
      .forEach((t) => {
        if (!tierMap.has(t.to)) {
          tierMap.set(t.to, currentTier + 1);
          queue.push(t.to);
        }
      });
  }

  // States not reached by BFS (disconnected) get their own tier
  states.forEach((s) => {
    if (!tierMap.has(s.key)) {
      const t = s.type === 3 ? 99 : s.type === 1 ? 0 : 50;
      tierMap.set(s.key, t);
    }
  });

  // Group by tier
  const tierGroups = new Map<number, WorkflowDefState[]>();
  states.forEach((s) => {
    const t = tierMap.get(s.key) ?? 50;
    if (!tierGroups.has(t)) tierGroups.set(t, []);
    tierGroups.get(t)!.push(s);
  });
  const sortedTiers = [...tierGroups.keys()].sort((a, b) => a - b);

  // Outgoing transitions per state for display
  const transMap = new Map<string, WorkflowDefTransition[]>();
  transitions.forEach((t) => {
    if (!transMap.has(t.from)) transMap.set(t.from, []);
    transMap.get(t.from)!.push(t);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* State legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { type: 1, label: 'Initial' },
          { type: 2, label: 'Intermediate' },
          { type: 3, label: 'Finish' },
          { type: 4, label: 'SubFlow' },
          { type: 5, label: 'Wizard' },
        ].map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('h-3 w-3 rounded-sm border', stateTypeColor(type))} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Tier-based state grid */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {sortedTiers.map((tier) => (
          <div key={tier} className="flex flex-col gap-2 min-w-[140px]">
            <span className="text-center text-xs font-medium text-muted-foreground">
              {tier === 0 ? 'Start' : tier === 99 ? 'End' : `Step ${tier}`}
            </span>
            {(tierGroups.get(tier) ?? []).map((state) => {
              const outgoing = transMap.get(state.key) ?? [];
              return (
                <div
                  key={state.key}
                  className={cn(
                    'rounded-md border-2 p-2.5 text-xs transition-shadow hover:shadow-md',
                    stateTypeColor(state.type ?? 2),
                  )}
                >
                  <div className="font-mono font-semibold">{state.key}</div>
                  <div className="mt-0.5 text-[10px] opacity-70">{STATE_TYPE_LABELS[state.type ?? 2]}</div>
                  {outgoing.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {outgoing.map((t) => (
                        <div key={t.key} className="flex items-center gap-1 text-[10px] opacity-80">
                          <span className="text-[8px]">→</span>
                          <span className="font-mono">{t.to}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Transitions table */}
      {transitions.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Transitions ({transitions.length})
          </h3>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  {['Key', 'From', 'To', 'Trigger'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transitions.map((t) => (
                  <tr key={t.key} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono font-medium">{t.key}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{t.from}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{t.to}</td>
                    <td className="px-3 py-2">
                      {t.triggerType != null ? (
                        <Badge variant={triggerBadgeVariant(t.triggerType)} className="text-[10px]">
                          {TRIGGER_TYPE_LABELS[t.triggerType] ?? String(t.triggerType)}
                        </Badge>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkflowDetailPage
// ---------------------------------------------------------------------------

interface WorkflowDetailPageProps {
  id: string;
}

export function WorkflowDetailPage({ id }: WorkflowDetailPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stateChartType, setStateChartType] = useState<ChartType>('bar');
  const [instanceStatus, setInstanceStatus] = useState<InstanceStatus | 'all'>('all');
  const [instancePage, setInstancePage] = useState(1);
  const [defView, setDefView] = useState<'visual' | 'raw'>('visual');

  // Metadata
  const { data: workflow, isLoading } = useWorkflowDetail(id);
  const { data: versions } = useWorkflowVersions(id);

  // Real API data
  const { data: stats } = useWorkflowStats(id);
  const { data: stateDist } = useWorkflowStateDistribution(id);
  const { data: permMatrix } = useWorkflowPermissionMatrix(id);
  const { data: deps } = useWorkflowDependencies(id);
  const { data: defItem } = useWorkflowDefinitionDetail(id);

  const { data: instanceData } = useInstanceList({
    workflowId: id,
    status: instanceStatus,
    page: instancePage,
    pageSize: 10,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading workflow…
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Workflow not found
      </div>
    );
  }

  const defStates = (defItem?.states as WorkflowDefState[] | undefined) ?? [];
  const defTransitions = (defItem?.transitions as WorkflowDefTransition[] | undefined) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{workflow.name}</h1>
            <Badge
              variant={WORKFLOW_TYPE_VARIANTS[workflow.type] ?? 'secondary'}
              className="font-mono text-xs"
            >
              {WORKFLOW_TYPE_LABELS[workflow.type] ?? workflow.type}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {workflow.domain} · {workflow.version}
          </p>
        </div>
        <VersionPicker
          currentVersion={workflow.version}
          versions={versions ?? [workflow.version]}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Overview                                                        */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Tags */}
          {workflow.tags.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {workflow.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-mono text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Instance distribution — real data from §3.1 */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Instance Distribution
            </h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {[
                { label: 'Active', value: stats?.active ?? 0, color: 'text-blue-600 dark:text-blue-400' },
                { label: 'Busy', value: stats?.busy ?? 0, color: 'text-yellow-600 dark:text-yellow-400' },
                { label: 'Faulted', value: stats?.faulted ?? 0, color: 'text-destructive' },
                { label: 'Passive', value: stats?.passive ?? 0, color: 'text-muted-foreground' },
                { label: 'Completed', value: stats?.completed ?? 0, color: 'text-green-600 dark:text-green-400' },
                { label: 'Total', value: stats?.total ?? 0, color: 'text-foreground' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className={cn('mt-2 text-3xl font-bold tracking-tight', color)}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* State distribution — real data from §3.3 */}
          {(stateDist?.states.length ?? 0) > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Active Instance State Distribution
              </h2>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <StateDistributionChart
                  states={stateDist!.states}
                  chartType={stateChartType}
                  onChartTypeChange={setStateChartType}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Definition                                                      */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'definition' && (
        <div className="flex flex-col gap-3">
          {/* Visual / Raw toggle */}
          <div className="flex items-center gap-1 self-start rounded-md border border-border bg-muted/30 p-0.5">
            {(['visual', 'raw'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDefView(v)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium capitalize transition-colors',
                  defView === v
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'visual' ? 'Visual' : 'Raw JSON'}
              </button>
            ))}
          </div>

          {defView === 'visual' ? (
            defStates.length > 0 ? (
              <WorkflowStateGraph states={defStates} transitions={defTransitions} />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {defItem === null ? 'Definition not available' : 'Loading definition…'}
              </div>
            )
          ) : (
            <RawJsonViewer data={defItem ?? {}} />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Instances                                                       */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'instances' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setInstanceStatus(opt.value); setInstancePage(1); }}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  instanceStatus === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            {!instanceData?.items.length ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No instances found
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['ID', 'Instance Key', 'Version', 'Current State', 'Effective State', 'Status', 'Created At', 'Modified At'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instanceData.items.map((inst) => (
                    <tr
                      key={inst.id}
                      onClick={() => navigate(`/instances/${inst.id}?workflow=${id}&domain=${config.domain}`)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground" title={inst.id}>{inst.id.slice(0, 8)}...</span></td>
                      <td className="px-4 py-3"><span className="font-mono text-xs text-foreground">{inst.key || '—'}</span></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.flowVersion || inst.workflowVersion || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.metadata?.currentState || inst.state || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.metadata?.effectiveState || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={resolveStatus(inst.status, inst.metadata?.status)} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(inst.metadata?.createdAt || inst.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(inst.metadata?.modifiedAt || inst.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {instancePage}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={instancePage <= 1} onClick={() => setInstancePage((p) => p - 1)}>← Prev</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={!(instanceData?.pagination?.hasNext ?? (instanceData?.items.length === 10))} onClick={() => setInstancePage((p) => p + 1)}>Next →</Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/definitions/workflows/${id}/instances`)} className="text-xs">
              View all →
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Related                                                         */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'related' && (
        <div className="flex flex-col gap-4">
          {!deps ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Loading dependencies…
            </div>
          ) : (() => {
            const categories: Array<{ key: keyof typeof deps.dependencies; label: string; compType: string }> = [
              { key: 'tasks', label: 'Tasks', compType: 'task' },
              { key: 'schemas', label: 'Schemas', compType: 'schema' },
              { key: 'views', label: 'Views', compType: 'view' },
              { key: 'functions', label: 'Functions', compType: 'function' },
              { key: 'extensions', label: 'Extensions', compType: 'extension' },
              { key: 'mappings', label: 'Mappings', compType: 'mapping' },
            ];
            const hasAny = categories.some((c) => (deps.dependencies[c.key]?.length ?? 0) > 0);
            if (!hasAny) {
              return (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No dependencies found
                </div>
              );
            }
            return (
              <>
                {categories.map(({ key, label, compType }) => {
                  const items = deps.dependencies[key] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={key}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label} ({items.length})
                      </h3>
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border bg-muted/50">
                            <tr>
                              {['Key', 'Version', 'Domain', 'Referenced From'].map((h) => (
                                <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((dep) => (
                              <tr key={dep.key} className="border-b border-border last:border-0 hover:bg-muted/20">
                                <td className="px-4 py-2.5">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/definitions/${compType}s/${dep.key}`)}
                                    className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    {dep.key}
                                  </button>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{dep.version}</td>
                                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{dep.domain}</td>
                                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{dep.referencedFrom ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Permissions                                                     */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'permissions' && (
        <div className="flex flex-col gap-4">
          {!permMatrix ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Loading permissions…
            </div>
          ) : (
            <>
              {/* Query roles */}
              {permMatrix.queryRoles.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Query Roles
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {permMatrix.queryRoles.map((r) => (
                      <Badge key={r.role} variant={r.grant === 'allow' ? 'success' : 'destructive'} className="text-xs font-mono">
                        {r.role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Transitions */}
              {permMatrix.transitions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Transition Permissions
                  </h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          {['Transition', 'From', 'Target', 'Roles'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {permMatrix.transitions.map((t) => (
                          <tr key={t.key} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-mono text-xs font-medium">{t.key}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.from}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.target}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {t.roles.map((r) => (
                                  <Badge key={r.role} variant={r.grant === 'allow' ? 'success' : 'destructive'} className="text-xs font-mono">
                                    {r.role}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Functions */}
              {permMatrix.functions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Function Permissions
                  </h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          {['Function', 'Roles'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {permMatrix.functions.map((f) => (
                          <tr key={f.key} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-mono text-xs font-medium">{f.key}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {f.roles.map((r) => (
                                  <Badge key={r.role} variant={r.grant === 'allow' ? 'success' : 'destructive'} className="text-xs font-mono">
                                    {r.role}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* State query roles */}
              {permMatrix.states.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    State Query Roles
                  </h3>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          {['State', 'Roles'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {permMatrix.states.map((s) => (
                          <tr key={s.key} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-mono text-xs font-medium">{s.key}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {s.queryRoles.map((r) => (
                                  <Badge key={r.role} variant={r.grant === 'allow' ? 'success' : 'destructive'} className="text-xs font-mono">
                                    {r.role}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {permMatrix.transitions.length === 0 && permMatrix.functions.length === 0 && permMatrix.queryRoles.length === 0 && (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No permissions defined for this workflow
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
