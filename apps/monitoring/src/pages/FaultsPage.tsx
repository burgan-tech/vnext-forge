import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
import { config } from '@monitoring/shared/config/config';
import { useDefinitionList } from '@monitoring/modules/definitions/api/definitions-queries';
import { useInstanceList } from '@monitoring/modules/instances/api/instances-queries';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function FaultsPage() {
  const navigate = useNavigate();
  const [selectedWorkflow, setSelectedWorkflow] = useState('');

  const { data: workflows, isLoading: loadingWorkflows } = useDefinitionList('workflow');
  const { data: instances, isLoading: loadingInstances, isError } = useInstanceList({
    workflowId: selectedWorkflow,
    status: 'Faulted',
    pageSize: 100,
  });

  const items = instances?.items ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold">Faulted Instances</h1>
        <p className="text-xs text-muted-foreground">
          Select a workflow to browse its faulted instances
        </p>
      </div>

      {/* Workflow selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Workflow</label>
        <select
          value={selectedWorkflow}
          onChange={(e) => setSelectedWorkflow(e.target.value)}
          disabled={loadingWorkflows}
          className="h-9 min-w-64 rounded-sm border border-border bg-background px-2 text-sm text-foreground shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50 disabled:opacity-50"
        >
          <option value="">— Select a workflow —</option>
          {(workflows ?? []).map((wf) => (
            <option key={wf.id} value={wf.id}>
              {wf.name} ({wf.version})
            </option>
          ))}
        </select>
        {selectedWorkflow && !loadingInstances && (
          <span className="text-xs text-muted-foreground">
            {instances?.total ?? items.length} faulted
          </span>
        )}
      </div>

      {/* Empty state — no workflow selected */}
      {!selectedWorkflow && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground text-sm">
          Select a workflow above to view its faulted instances
        </div>
      )}

      {/* Table */}
      {selectedWorkflow && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                {['Instance Key', 'Version', 'State', 'Status', 'Created At', 'Last Updated'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingInstances && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-destructive">Failed to load faulted instances.</td>
                </tr>
              )}
              {!loadingInstances && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No faulted instances for this workflow.
                  </td>
                </tr>
              )}
              {!loadingInstances && !isError && items.map((instance) => (
                <tr
                  key={instance.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() =>
                    navigate(`/instances/${instance.id}?workflow=${selectedWorkflow}&domain=${config.domain}`)
                  }
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{instance.key}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{instance.workflowVersion}</td>
                  <td className="px-4 py-3 font-mono text-xs">{instance.state}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={instance.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(instance.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(instance.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
