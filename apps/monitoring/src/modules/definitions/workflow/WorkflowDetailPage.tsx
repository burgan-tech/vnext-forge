import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button } from '@vnext-forge-studio/designer-ui/ui';
import { config } from '@monitoring/shared/config/config';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useWorkflowDetail, useWorkflowVersions } from '@monitoring/modules/definitions/api/definitions-queries';
import { useInstanceList } from '@monitoring/modules/instances/api/instances-queries';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
import type { InstanceStatus } from '@monitoring/shared/types';

const WORKFLOW_TYPE_LABELS: Record<string, string> = { F: 'Flow', S: 'State', P: 'Process' };
const WORKFLOW_TYPE_VARIANTS: Record<string, 'info' | 'warning' | 'secondary'> = {
  F: 'info', S: 'warning', P: 'secondary',
};

type Tab = 'overview' | 'definition' | 'instances' | 'performance' | 'related' | 'permissions';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'instances', label: 'Instances' },
  { id: 'performance', label: 'Performance' },
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
  { label: 'Terminated', value: 'Terminated' },
];

function formatDateTime(iso: string): string {
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

interface WorkflowDetailPageProps {
  id: string;
}

export function WorkflowDetailPage({ id }: WorkflowDetailPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [instanceStatus, setInstanceStatus] = useState<InstanceStatus | 'all'>('all');
  const [instancePage, setInstancePage] = useState(1);

  const { data: workflow, isLoading } = useWorkflowDetail(id);
  const { data: versions } = useWorkflowVersions(id);
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

  const stats = workflow.stats;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{workflow.name}</h1>
            <Badge
              variant={WORKFLOW_TYPE_VARIANTS[workflow.type] ?? 'secondary'}
              className="font-mono text-xs"
            >
              {WORKFLOW_TYPE_LABELS[workflow.type] ?? workflow.type}
            </Badge>
            {workflow.warn && (
              <Badge variant="warning" className="text-xs">{workflow.warn}</Badge>
            )}
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

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <p className="text-sm text-foreground">{workflow.description || 'No description.'}</p>
              {workflow.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {workflow.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-mono text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author</span>
                <span className="font-mono text-xs">{workflow.author || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-mono text-xs">{formatDateTime(workflow.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Instance Distribution
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Active', value: stats.active },
                { label: 'Busy', value: stats.busy },
                { label: 'Faulted', value: stats.faulted },
                { label: 'Suspended', value: stats.suspended },
                { label: 'Completed', value: stats.completed },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {stats.stateDistribution.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                State Distribution
              </h2>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-2">
                  {stats.stateDistribution.map(({ state, count }) => {
                    const maxCount = Math.max(...stats.stateDistribution.map((s) => s.count));
                    const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                    return (
                      <div key={state} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 font-mono text-xs text-foreground">{state}</span>
                        <div className="flex-1 rounded-full bg-muted h-2">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Definition */}
      {activeTab === 'definition' && (
        <RawJsonViewer data={workflow.definition} />
      )}

      {/* Tab: Instances */}
      {activeTab === 'instances' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
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
                    {['Instance Key', 'Version', 'State', 'Status', 'Created At', 'Duration'].map((h) => (
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
                      <td className="px-4 py-3"><span className="font-mono text-xs font-medium text-primary">{inst.key}</span></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.workflowVersion}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.state}</td>
                      <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(inst.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDuration(inst.createdAt, inst.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{instanceData?.total ?? 0} total instances</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={instancePage <= 1} onClick={() => setInstancePage((p) => p - 1)}>← Prev</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={!instanceData || instancePage >= Math.ceil(instanceData.total / 10)} onClick={() => setInstancePage((p) => p + 1)}>Next →</Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/definitions/workflows/${id}/instances`)} className="text-xs">
              View all →
            </Button>
          </div>
        </div>
      )}

      {/* Tab: Performance */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Avg Duration', value: stats.duration.avg },
            { label: 'Min Duration', value: stats.duration.min },
            { label: 'Max Duration', value: stats.duration.max },
            { label: 'P95 Duration', value: stats.duration.p95 },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight font-mono text-foreground">{value || '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Related */}
      {activeTab === 'related' && (
        <RelatedComponentsList components={workflow.relatedComponents} />
      )}

      {/* Tab: Permissions */}
      {activeTab === 'permissions' && (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          {workflow.permissions.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No permissions defined
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['State', 'State Type', 'Transitions', 'Functions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workflow.permissions.map((perm, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{perm.state}</td>
                    <td className="px-4 py-3">
                      <Badge variant={perm.stateType === 'SubFlow' ? 'info' : 'secondary'} className="text-xs">
                        {perm.stateType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {perm.transitions.map((t) => (
                          <div key={t.name} className="flex items-center gap-2 text-xs">
                            <span className="font-mono">{t.name}</span>
                            <span className="text-muted-foreground">{t.roles.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {perm.functions.map((f) => (
                          <div key={f.name} className="flex items-center gap-2 text-xs">
                            <span className="font-mono">{f.name}</span>
                            <span className="text-muted-foreground">{f.roles.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
