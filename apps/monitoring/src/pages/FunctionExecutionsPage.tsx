import { useNavigate } from 'react-router-dom';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { useDomainFunctions } from '@monitoring/modules/functions/api/functions-queries';

export function FunctionExecutionsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDomainFunctions();
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold">Domain Functions</h1>
          <p className="text-xs text-muted-foreground">
            Domain-scope functions available for direct invocation
          </p>
        </div>
        {!isLoading && (
          <span className="text-sm text-muted-foreground">
            {data?.total ?? items.length} function{(data?.total ?? items.length) !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              {['Key', 'Version', 'Scope', 'Tasks', 'Roles'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-destructive">Failed to load functions.</td>
              </tr>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No domain-scope functions found.</td>
              </tr>
            )}
            {!isLoading && !isError && items.map((fn) => (
              <tr
                key={fn.key}
                className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/function-executions/${fn.key}`)}
              >
                <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{fn.key}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fn.version}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-xs">{fn.scope}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground text-center">{fn.taskCount}</td>
                <td className="px-4 py-3">
                  {fn.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {fn.roles.map((r) => (
                        <Badge
                          key={r.role}
                          variant={r.grant === 'allow' ? 'success' : 'destructive'}
                          className="text-xs"
                        >
                          {r.role}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
