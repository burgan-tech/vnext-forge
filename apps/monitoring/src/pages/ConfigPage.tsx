import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { config } from '@monitoring/shared/config/config';
import { useDomainConfig } from '@monitoring/modules/config/api/config-queries';

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <Badge variant={value ? 'success' : 'secondary'} className="text-xs">
      {value ? 'Enabled' : 'Disabled'}
    </Badge>
  );
}

export function ConfigPage() {
  const { data: runtimeConfig, isLoading, isError } = useDomainConfig();

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">Configuration</h1>

      {/* Active domain */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active Domain
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Domain Key</dt>
            <dd className="mt-0.5 font-mono font-medium">{config.domain}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">API Base URL</dt>
            <dd className="mt-0.5 font-mono text-xs font-medium">
              {config.apiBaseUrl || '(Vite proxy — relative)'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Runtime config */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Runtime Config
        </h2>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading runtime config…</p>
        )}
        {isError && (
          <p className="text-sm text-destructive">Failed to load runtime config.</p>
        )}
        {runtimeConfig && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Runtime Version</dt>
              <dd className="mt-0.5 font-mono font-medium">{runtimeConfig.runtimeVersion}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Redis Mode</dt>
              <dd className="mt-0.5 font-mono font-medium">{runtimeConfig.monitor.redisMode}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tracing</dt>
              <dd className="mt-0.5"><BooleanBadge value={runtimeConfig.monitor.tracingEnabled} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Metrics</dt>
              <dd className="mt-0.5"><BooleanBadge value={runtimeConfig.monitor.metricsEnabled} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vault</dt>
              <dd className="mt-0.5"><BooleanBadge value={runtimeConfig.monitor.vaultEnabled} /></dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
