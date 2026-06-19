import { useState } from 'react';
import { InstanceWorkflowCanvas } from '@monitoring/modules/instances/components/InstanceWorkflowCanvas';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Badge, Button } from '@vnext-forge-studio/designer-ui/ui';
import { ChevronRight, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@monitoring/shared/lib/utils';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
import { config } from '@monitoring/shared/config/config';
import {
  useInstanceDetail,
  useInstanceTimeline,
  useInstanceState,
  useInstanceData,
  useInstanceDataDiff,
  useInstanceTasks,
  useInstanceFaults,
  useInstancePermissions,
  useInstanceHierarchy,
  useInstanceParent,
} from '@monitoring/modules/instances/api/instances-queries';
import type {
  InstanceDetailResponse,
  TimelineTransition,
  InstanceTaskItem,
  DataVersionEntry,
  InstanceDataDiffResponse,
  HierarchyNode,
  ActiveCorrelation,
  PermissionTransition,
  PermissionFunction,
  RoleGrant,
} from '@monitoring/shared/types/instance-api';
import type { InstanceStatus } from '@monitoring/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDurationSec(sec: number | null | undefined): string {
  if (sec == null) return '—';
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m < 60 ? `${m}m ${s}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return formatDurationSec(ms / 1000);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'state-graph' | 'transitions' | 'task-log' | 'data' | 'correlations' | 'permissions';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'state-graph', label: 'State Graph' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'task-log', label: 'Task Log' },
  { id: 'data', label: 'Data' },
  { id: 'correlations', label: 'Correlations' },
  { id: 'permissions', label: 'Permissions' },
];

// ---------------------------------------------------------------------------
// State Graph
// ---------------------------------------------------------------------------

interface StateGraphProps {
  workflow: string;
  instanceId: string;
  currentState: string;
}

function StateGraph({ workflow, instanceId, currentState }: StateGraphProps) {
  const { data: timeline } = useInstanceTimeline(workflow, instanceId);
  const { data: stateData } = useInstanceState(workflow, instanceId);

  if (!timeline && !stateData) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading state graph…
      </div>
    );
  }

  // Build visited states in chronological order from timeline
  const visited: string[] = [];
  const seenStates = new Set<string>();
  for (const t of timeline?.transitions ?? []) {
    if (t.fromState && !seenStates.has(t.fromState)) {
      visited.push(t.fromState);
      seenStates.add(t.fromState);
    }
  }
  // Ensure current state is included
  if (currentState && !seenStates.has(currentState)) {
    visited.push(currentState);
    seenStates.add(currentState);
  }

  const available = stateData?.availableTransitions ?? [];

  return (
    <div className="space-y-6 p-4">
      {/* Flow timeline */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          State Flow
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {visited.map((state, i) => {
            const isCurrent = state === currentState;
            const isPast = !isCurrent;
            return (
              <div key={state} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-mono font-medium',
                    isCurrent
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : isPast
                        ? 'border-border bg-muted/40 text-muted-foreground'
                        : 'border-border bg-background text-foreground',
                  )}
                >
                  {isCurrent && (
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                  {state}
                  {isCurrent && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      current
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available transitions */}
      {available.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Available Transitions from <span className="font-mono text-foreground">{currentState}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {available.map((t) => (
              <div key={t.key} className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className="rounded-md border border-dashed border-primary/50 bg-primary/5 px-3 py-1.5 text-xs">
                  <span className="font-mono font-medium text-foreground">{t.target}</span>
                  <span className="ml-2 text-muted-foreground">via</span>
                  <span className="ml-1 font-mono text-primary">{t.key}</span>
                  <span className="ml-2 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                    {t.triggerType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transition counts */}
      {timeline && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          {timeline.transitions.length} transition{timeline.transitions.length !== 1 ? 's' : ''} completed
          {' · '}
          {visited.length} unique state{visited.length !== 1 ? 's' : ''} visited
          {available.length > 0 && ` · ${available.length} next transition${available.length !== 1 ? 's' : ''} available`}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transitions Tab
// ---------------------------------------------------------------------------

function TransitionsTab({ transitions }: { transitions: TimelineTransition[] }) {
  if (!transitions.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No transitions recorded.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Transition</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">From</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">To</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Trigger</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Started</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Duration</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">By</th>
          </tr>
        </thead>
        <tbody>
          {transitions.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                {t.transitionId}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.fromState}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.toState}</td>
              <td className="px-4 py-2.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {t.triggerType}
                </span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                {formatDateTime(t.startedAt)}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {formatDurationSec(t.durationSeconds)}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.createdBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task Log Tab
// ---------------------------------------------------------------------------

const TASK_STATUS_VARIANTS: Record<string, 'success' | 'destructive' | 'info' | 'warning' | 'muted'> = {
  Completed: 'success',
  Faulted: 'destructive',
  Running: 'info',
  Pending: 'warning',
};

function TaskLogTab({ tasks }: { tasks: InstanceTaskItem[] }) {
  if (!tasks.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No tasks recorded.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Task Key</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Business Status</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Started</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Duration</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                {t.taskDefinitionKey}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={TASK_STATUS_VARIANTS[t.status] ?? 'muted'}>
                  {t.status}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.businessStatus}</td>
              <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                {formatDateTime(t.startedAt)}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {formatDurationMs(t.durationMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Tab
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Data Diff View (§1.8)
// ---------------------------------------------------------------------------

function DataDiffView({ diff }: { diff: InstanceDataDiffResponse }) {
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

  if (!hasChanges) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        No differences. {diff.unchangedCount} field{diff.unchangedCount !== 1 ? 's' : ''} unchanged.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {diff.added.map((f) => (
        <div
          key={`add-${f.path}`}
          className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950/30"
        >
          <span className="mt-0.5 rounded bg-green-200 px-1 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-900 dark:text-green-200">
            +
          </span>
          <span className="font-mono text-xs text-foreground">{f.path}</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{f.value}</span>
        </div>
      ))}
      {diff.removed.map((f) => (
        <div
          key={`rem-${f.path}`}
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30"
        >
          <span className="mt-0.5 rounded bg-red-200 px-1 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-900 dark:text-red-200">
            −
          </span>
          <span className="font-mono text-xs text-foreground">{f.path}</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{f.value}</span>
        </div>
      ))}
      {diff.changed.map((f) => (
        <div
          key={`chg-${f.path}`}
          className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 dark:border-yellow-900 dark:bg-yellow-950/30"
        >
          <div className="flex items-center gap-2">
            <span className="rounded bg-yellow-200 px-1 py-0.5 text-[10px] font-bold text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              ~
            </span>
            <span className="font-mono text-xs text-foreground">{f.path}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 pl-6 text-xs">
            <span className="font-mono line-through text-destructive">{f.oldValue}</span>
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="font-mono text-success">{f.newValue}</span>
          </div>
        </div>
      ))}
      <p className="text-right text-xs text-muted-foreground">
        {diff.unchangedCount} field{diff.unchangedCount !== 1 ? 's' : ''} unchanged
      </p>
    </div>
  );
}

function DataVersionRow({ entry, index }: { entry: DataVersionEntry; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-foreground">{entry.version}</span>
          <span className="text-xs text-muted-foreground">{formatDateTime(entry.enteredAt)}</span>
        </div>
        <ChevronRight
          className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify(entry.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function DataTab({ workflow, instanceId }: { workflow: string; instanceId: string }) {
  const { data, isLoading } = useInstanceData(workflow, instanceId);
  const [diffFrom, setDiffFrom] = useState('');
  const [diffTo, setDiffTo] = useState('');
  const { data: diff, isLoading: diffLoading } = useInstanceDataDiff(
    workflow,
    instanceId,
    diffFrom,
    diffTo,
  );

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Loading data…
      </div>
    );
  }

  const latestData = data?.latestData;
  const versions = data?.versionHistory ?? [];

  return (
    <div className="space-y-6 p-4">
      {/* Latest data */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Current Data
        </p>
        {latestData ? (
          <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
            {JSON.stringify(latestData, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">No data.</p>
        )}
      </div>

      {/* Compare versions — §1.8 */}
      {versions.length >= 2 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Compare Versions
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={diffFrom}
              onChange={(e) => setDiffFrom(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">From…</option>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version}
                </option>
              ))}
            </select>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <select
              value={diffTo}
              onChange={(e) => setDiffTo(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">To…</option>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version}
                </option>
              ))}
            </select>
          </div>
          {diffFrom && diffTo && (
            <div className="mt-3">
              {diffLoading ? (
                <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
                  Loading diff…
                </div>
              ) : diff ? (
                <DataDiffView diff={diff} />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Version history */}
      {versions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Version History ({versions.length})
          </p>
          <div className="rounded-md border border-border">
            {versions.map((v, i) => (
              <DataVersionRow key={v.version} entry={v} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Correlations Tab
// ---------------------------------------------------------------------------

function HierarchyNodeRow({
  node,
  depth,
  navigate,
  workflow,
}: {
  node: HierarchyNode;
  depth: number;
  navigate: (path: string) => void;
  workflow: string;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
        onClick={() =>
          navigate(
            `/instances/${node.instanceId}?workflow=${node.flow}&domain=${node.domain}`,
          )
        }
      >
        <td className="px-4 py-2.5">
          <span style={{ paddingLeft: depth * 16 }} className="flex items-center gap-1.5">
            {depth > 0 && <span className="text-muted-foreground">↳</span>}
            <span className="font-mono text-xs font-medium text-primary">{node.key}</span>
          </span>
        </td>
        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{node.flow}</td>
        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{node.currentState}</td>
        <td className="px-4 py-2.5">
          <StatusBadge status={node.status as InstanceStatus} />
        </td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">
          {node.subFlowType === 'S' ? 'SubFlow' : node.subFlowType === 'P' ? 'SubProcess' : 'Root'}
        </td>
        <td className="px-4 py-2.5">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </td>
      </tr>
      {node.children.map((child) => (
        <HierarchyNodeRow
          key={child.instanceId}
          node={child}
          depth={depth + 1}
          navigate={navigate}
          workflow={workflow}
        />
      ))}
    </>
  );
}

function CorrelationsTab({
  workflow,
  instanceId,
  activeCorrelations,
}: {
  workflow: string;
  instanceId: string;
  activeCorrelations: ActiveCorrelation[];
}) {
  const { data: hierarchy, isLoading } = useInstanceHierarchy(workflow, instanceId);
  const navigate = useNavigate();

  const hasCorrelations = activeCorrelations.length > 0;
  const hasHierarchy = hierarchy && (hierarchy.children.length > 0 || hierarchy.parentState !== null);

  return (
    <div className="space-y-6 p-4">
      {/* Active sub-flows */}
      {hasCorrelations && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active Sub-Flows / Sub-Processes
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Sub-Flow</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Parent State</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Current State</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Version</th>
                </tr>
              </thead>
              <tbody>
                {activeCorrelations.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() =>
                      navigate(
                        `/instances/${c.subFlowInstanceId}?workflow=${c.subFlowName}&domain=${c.subFlowDomain}`,
                      )
                    }
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-primary">
                      {c.subFlowName}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {c.subFlowType === 'S' ? 'SubFlow' : 'SubProcess'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {c.parentState}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {c.subFlowCurrentState}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.subFlowVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hierarchy tree */}
      {isLoading ? (
        <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
          Loading hierarchy…
        </div>
      ) : hasHierarchy && hierarchy ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Instance Hierarchy
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Key</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Flow</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">State</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                <HierarchyNodeRow
                  node={hierarchy}
                  depth={0}
                  navigate={navigate}
                  workflow={workflow}
                />
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !hasCorrelations && (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No correlations or sub-flows.
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissions Tab
// ---------------------------------------------------------------------------

function RoleGrantPills({ roles }: { roles: RoleGrant[] }) {
  if (!roles.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span
          key={r.role}
          className={cn(
            'rounded px-1.5 py-0.5 text-[11px] font-medium',
            r.grant === 'allow'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive',
          )}
        >
          {r.role}
        </span>
      ))}
    </div>
  );
}

function PermissionsTab({ workflow, instanceId }: { workflow: string; instanceId: string }) {
  const { data, isLoading } = useInstancePermissions(workflow, instanceId);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Loading permissions…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No permission data.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Query roles */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Query Roles (Workflow-level)
        </p>
        <div className="rounded-md border border-border p-3">
          <RoleGrantPills roles={data.queryRoles} />
        </div>
      </div>

      {/* Current state roles */}
      {data.state && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Current State: <span className="font-mono text-foreground">{data.state.key}</span>
          </p>
          <div className="rounded-md border border-border p-3">
            <RoleGrantPills roles={data.state.queryRoles} />
          </div>
        </div>
      )}

      {/* Transitions */}
      {data.transitions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Transition Permissions
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Transition</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">From</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Target</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Roles</th>
                </tr>
              </thead>
              <tbody>
                {data.transitions.map((t: PermissionTransition) => (
                  <tr key={t.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium">{t.key}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.from}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.target}</td>
                    <td className="px-4 py-2.5"><RoleGrantPills roles={t.roles} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Functions */}
      {data.functions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Function Permissions
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Function</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Roles</th>
                </tr>
              </thead>
              <tbody>
                {data.functions.map((f: PermissionFunction) => (
                  <tr key={f.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium">{f.key}</td>
                    <td className="px-4 py-2.5"><RoleGrantPills roles={f.roles} /></td>
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
// Overview Tab
// ---------------------------------------------------------------------------

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function OverviewTab({
  detail,
  workflow,
  instanceId,
}: {
  detail: InstanceDetailResponse;
  workflow: string;
  instanceId: string;
}) {
  const m = detail.metadata;
  const isFaulted = m.status === 'Faulted';
  const { data: faultsData } = useInstanceFaults(workflow, instanceId, isFaulted);

  return (
    <div className="space-y-6 p-4">
      {/* Fault alert */}
      {isFaulted && faultsData && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="mb-2 text-sm font-semibold text-destructive">Fault Details</p>
          {faultsData.faultedTransition && (
            <p className="mb-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Failed transition:</span>{' '}
              <span className="font-mono">{faultsData.faultedTransition.transitionId}</span>
              {' · '}from{' '}
              <span className="font-mono">{faultsData.faultedTransition.fromState}</span>
            </p>
          )}
          {faultsData.faultedTasks.map((t) => (
            <div key={t.id} className="mt-2 rounded bg-destructive/10 p-2 text-xs">
              <span className="font-mono font-medium">{t.taskId}</span>
              <span className="ml-2 text-muted-foreground">
                {t.businessStatus} · {formatDurationMs(t.durationSeconds * 1000)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Instance meta */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Instance
        </p>
        <div className="rounded-md border border-border divide-y divide-border px-4">
          <MetaRow label="Key" value={<span className="font-mono text-sm">{detail.key}</span>} />
          <MetaRow label="Flow" value={<span className="font-mono text-sm">{detail.flow}</span>} />
          <MetaRow label="Version" value={detail.flowVersion} />
          <MetaRow label="Domain" value={detail.domain} />
          {detail.tags.length > 0 && (
            <MetaRow
              label="Tags"
              value={
                <div className="flex flex-wrap gap-1">
                  {detail.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              }
            />
          )}
        </div>
      </div>

      {/* State & status */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          State
        </p>
        <div className="rounded-md border border-border divide-y divide-border px-4">
          <MetaRow
            label="Current State"
            value={<span className="font-mono text-sm font-semibold">{m.currentState}</span>}
          />
          <MetaRow
            label="State Type"
            value={
              <Badge variant="info">{m.effectiveStateType}</Badge>
            }
          />
          {m.effectiveStateSubType && (
            <MetaRow
              label="Sub Type"
              value={<Badge variant="secondary">{m.effectiveStateSubType}</Badge>}
            />
          )}
          <MetaRow
            label="Status"
            value={<StatusBadge status={m.status as InstanceStatus} />}
          />
        </div>
      </div>

      {/* Lifecycle */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lifecycle
        </p>
        <div className="rounded-md border border-border divide-y divide-border px-4">
          <MetaRow label="Created" value={formatDateTime(m.createdAt)} />
          <MetaRow label="Created By" value={m.createdBy} />
          {m.createdByBehalfOf && (
            <MetaRow label="On Behalf Of" value={m.createdByBehalfOf} />
          )}
          <MetaRow label="Last Modified" value={formatDateTime(m.modifiedAt)} />
          {m.modifiedBy && <MetaRow label="Modified By" value={m.modifiedBy} />}
          {m.completedAt && <MetaRow label="Completed" value={formatDateTime(m.completedAt)} />}
          {m.duration != null && (
            <MetaRow label="Duration" value={formatDurationMs(m.duration)} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstanceDetailPage
// ---------------------------------------------------------------------------

export function InstanceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const workflow = searchParams.get('workflow') ?? '';
  const domain = searchParams.get('domain') ?? config.domain;

  const [tab, setTab] = useState<TabId>('overview');

  const { data: detail, isLoading, isError, refetch } = useInstanceDetail(workflow, instanceId ?? '');
  const { data: timelineData } = useInstanceTimeline(workflow, instanceId ?? '');
  const { data: tasksData } = useInstanceTasks(workflow, instanceId ?? '');
  const { data: parentData } = useInstanceParent(workflow, instanceId ?? '');

  if (!workflow || !instanceId) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
        Missing workflow or instance context. Navigate here from an instance list.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
        Loading instance…
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive">Failed to load instance.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  const m = detail.metadata;

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {/* Parent navigation — §1.10 */}
            {parentData?.parent && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/instances/${parentData.parent!.parentInstanceId}?workflow=${parentData.parent!.flow}&domain=${parentData.parent!.domain}`,
                  )
                }
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-3 w-3 rotate-180" />
                <span>Parent:</span>
                <span className="font-mono font-medium">{parentData.parent.key}</span>
                <span className="text-muted-foreground">({parentData.parent.flow})</span>
                <span className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  {parentData.parent.correlationType === 'S' ? 'SubFlow' : 'SubProcess'}
                </span>
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-foreground">{detail.key}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(detail.id)}
                title="Copy instance ID"
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <StatusBadge status={m.status as InstanceStatus} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => navigate(`/definitions/workflow/${detail.flow}`)}
                className="flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <span className="font-mono">{detail.flow}</span>
              </button>
              <span>·</span>
              <span>v{detail.flowVersion}</span>
              <span>·</span>
              <span className="font-mono text-xs">{domain}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                State
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">
                {m.currentState}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-0 border-b border-transparent">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'relative px-4 py-2 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.id === 'task-log' && tasksData && tasksData.total > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                  {tasksData.total}
                </span>
              )}
              {t.id === 'transitions' && timelineData && timelineData.transitions.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                  {timelineData.transitions.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 bg-background">
        {tab === 'overview' && (
          <OverviewTab detail={detail} workflow={workflow} instanceId={instanceId} />
        )}
        {tab === 'state-graph' && (
          <InstanceWorkflowCanvas workflow={workflow} instanceId={instanceId} currentState={m.currentState} />
        )}
        {tab === 'transitions' && (
          <div className="overflow-x-auto rounded-md border-0">
            {timelineData ? (
              <TransitionsTab transitions={timelineData.transitions} />
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Loading transitions…
              </div>
            )}
          </div>
        )}
        {tab === 'task-log' && (
          <div className="overflow-x-auto">
            {tasksData ? (
              <TaskLogTab tasks={tasksData.items} />
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Loading task log…
              </div>
            )}
          </div>
        )}
        {tab === 'data' && (
          <DataTab workflow={workflow} instanceId={instanceId} />
        )}
        {tab === 'correlations' && (
          <CorrelationsTab
            workflow={workflow}
            instanceId={instanceId}
            activeCorrelations={detail.activeCorrelations}
          />
        )}
        {tab === 'permissions' && (
          <PermissionsTab workflow={workflow} instanceId={instanceId} />
        )}
      </div>
    </div>
  );
}
