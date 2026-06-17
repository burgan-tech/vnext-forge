import { useNavigate } from 'react-router-dom';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { config } from '@monitoring/shared/config/config';
import { useDomainJobs } from '@monitoring/modules/jobs/api/jobs-queries';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function JobsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDomainJobs();
  const jobs = data?.jobs ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold">Active Jobs</h1>
          <p className="text-xs text-muted-foreground">
            Scheduled timers and delayed jobs in domain <span className="font-mono text-foreground">{config.domain}</span>
          </p>
        </div>
        {!isLoading && (
          <span className="text-sm text-muted-foreground">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              {['Job ID', 'Name', 'Workflow', 'Instance', 'Status', 'Created At', 'Modified At'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-destructive">Failed to load jobs.</td>
              </tr>
            )}
            {!isLoading && !isError && jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No active jobs found.</td>
              </tr>
            )}
            {!isLoading && !isError && jobs.map((job) => (
              <tr key={job.jobId} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{job.jobId}</td>
                <td className="px-4 py-3 font-mono text-xs">{job.name}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/definitions/workflows/${job.flow}`)}
                    className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {job.flow}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/instances/${job.instanceId}?workflow=${job.flow}&domain=${job.domain}`)
                    }
                    className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {job.instanceId}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={job.isActive ? 'success' : 'secondary'} className="text-xs">
                    {job.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(job.createdAt)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(job.modifiedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
