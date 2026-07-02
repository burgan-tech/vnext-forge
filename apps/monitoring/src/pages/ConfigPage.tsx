import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { config } from '@monitoring/shared/config/config';
import { useDomainConfig, useHealthDetail } from '@monitoring/modules/config/api/config-queries';

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <Badge variant={value ? 'success' : 'secondary'} className="text-xs">
      {value ? 'Enabled' : 'Disabled'}
    </Badge>
  );
}

function healthVariant(status: string): 'success' | 'destructive' | 'warning' {
  if (status === 'Healthy') return 'success';
  if (status === 'Unhealthy') return 'destructive';
  return 'warning';
}

export function ConfigPage() {
  const { data: runtimeConfig, isLoading: loadingConfig, isError: configError } = useDomainConfig();
  const { data: health, isLoading: loadingHealth } = useHealthDetail();

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
        {loadingConfig && <p className="text-sm text-muted-foreground">Loading…</p>}
        {configError && <p className="text-sm text-destructive">Failed to load runtime config.</p>}
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

      {/* Health check — §8.1 */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            System Health
          </h2>
          {health && (
            <Badge variant={healthVariant(health.status)} className="text-xs">
              {health.status} · {health.totalDurationMs.toFixed(1)}ms
            </Badge>
          )}
        </div>
        {loadingHealth && <p className="text-sm text-muted-foreground">Loading health…</p>}
        {health && (
          <div className="flex flex-col gap-2">
            {health.entries.map((entry) => (
              <div
                key={entry.name}
                className={cn(
                  'flex items-start justify-between rounded-md border px-3 py-2.5',
                  entry.status === 'Healthy'
                    ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                    : entry.status === 'Unhealthy'
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30',
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs font-semibold capitalize">{entry.name}</span>
                  {entry.description && (
                    <span className="text-xs text-muted-foreground">{entry.description}</span>
                  )}
                  {entry.exception && (
                    <span className="text-xs text-destructive">{entry.exception}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="font-mono text-xs text-muted-foreground">{entry.durationMs.toFixed(1)}ms</span>
                  <Badge variant={healthVariant(entry.status)} className="text-xs">{entry.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
