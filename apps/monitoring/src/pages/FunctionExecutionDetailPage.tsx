import { useParams, useNavigate } from 'react-router-dom';
import { Badge, Button } from '@vnext-forge-studio/designer-ui/ui';
import { ChevronLeft } from 'lucide-react';
import { useDefinitionList } from '@monitoring/modules/definitions/api/definitions-queries';

export function FunctionExecutionDetailPage() {
  const { execId } = useParams<{ execId: string }>();
  const navigate = useNavigate();

  const { data: functionsPage, isLoading, isError } = useDefinitionList('function');
  const fn = functionsPage?.items.find((f) => f.id === execId);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-1 text-xs text-muted-foreground"
        onClick={() => navigate('/function-executions')}
      >
        <ChevronLeft size={14} />
        Back to functions
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold font-mono">{execId}</h1>
        {fn && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs">{fn.type ?? 'Function'}</Badge>
            <span>Version: <span className="font-mono text-foreground">{fn.version}</span></span>
            <span>Domain: <span className="font-mono text-foreground">{fn.domain}</span></span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
      )}
      {isError && (
        <div className="py-8 text-center text-destructive text-sm">Failed to load function details.</div>
      )}

      {!isLoading && !isError && !fn && (
        <div className="py-8 text-center text-muted-foreground text-sm">
          Function <span className="font-mono">{execId}</span> not found in definitions.
        </div>
      )}

      {fn && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Function Details
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {[
              ['Key', fn.id],
              ['Name', fn.name],
              ['Version', fn.version],
              ['Domain', fn.domain],
              ['Type', fn.type ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 font-medium font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
