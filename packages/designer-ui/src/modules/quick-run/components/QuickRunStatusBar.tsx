import { useQuickRunStore } from '../store/quickRunStore';

const HEALTH_CONFIG = {
  healthy: { dot: 'bg-[var(--vscode-charts-green)]', label: 'Runtime Connected' },
  unhealthy: { dot: 'bg-[var(--vscode-errorForeground)]', label: 'Runtime Disconnected' },
  unknown: { dot: 'bg-[var(--vscode-descriptionForeground)]', label: 'Runtime Unknown' },
} as const;

export function QuickRunStatusBar() {
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const environmentName = useQuickRunStore((s) => s.environmentName);
  const instances = useQuickRunStore((s) => s.instances);
  const activeState = useQuickRunStore((s) => s.activeState);
  const pollingInstanceId = useQuickRunStore((s) => s.pollingInstanceId);
  const runtimeHealth = useQuickRunStore((s) => s.runtimeHealth);

  const activeCount = Array.from(instances.values()).filter(
    (i) => i.status === 'A' || i.status === 'B',
  ).length;

  const healthCfg = HEALTH_CONFIG[runtimeHealth];

  return (
    <footer
      className="flex items-center gap-3 border-t border-[var(--vscode-panel-border)] bg-[var(--vscode-statusBar-background)] px-3 py-1 text-[11px] text-[var(--vscode-statusBar-foreground)]"
      role="status"
    >
      <span className="flex items-center gap-1.5 font-semibold">
        <span className={`inline-block h-2 w-2 rounded-full ${healthCfg.dot}`} title={healthCfg.label} />
        vNext Forge
      </span>
      <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">{healthCfg.label}</span>
      {environmentName && (
        <span className="rounded bg-[var(--vscode-badge-background)] px-1.5 py-0.5 text-[10px] text-[var(--vscode-badge-foreground)]">
          {environmentName}
        </span>
      )}
      <span>{domain}/{workflowKey}</span>
      {activeState && (
        <span>
          State: <strong>{activeState.state}</strong>
        </span>
      )}
      {pollingInstanceId && (
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--vscode-progressBar-background)]" />
          Updating...
        </span>
      )}
      <span className="ml-auto">{activeCount} instance{activeCount !== 1 ? 's' : ''} active</span>
    </footer>
  );
}
