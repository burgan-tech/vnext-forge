import { useNow } from '../hooks/useNow';
import { useQuickRunStore } from '../store/quickRunStore';
import { formatCountdown } from '../utils/countdown';

/**
 * `interaction.longPoll.terminate: false`: the state asks clients to keep
 * polling for `fallbackTimeoutSeconds` instead of their own default. Shown
 * while the poll loop holds that window open for the active instance.
 * Informational — nothing to acknowledge.
 */
export function KeepPollingBanner({ instanceId }: { instanceId: string | null }) {
  const window = useQuickRunStore((s) => s.keepPolling);
  const active = !!window && window.instanceId === instanceId;
  const nowMs = useNow(active ? 1000 : null);
  if (!active) return null;
  const left = Math.max(0, window.deadlineMs - nowMs);
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)] px-3 py-2 text-[11px]"
    >
      <span className="font-semibold">Keeping the poll open</span>{' '}
      <span className="text-muted-text">
        This state asks clients to keep polling for {window.fallbackTimeoutSeconds}s
        {left > 0 ? ` — ${formatCountdown(left)} left` : ''}. Transitions stay available.
      </span>
    </section>
  );
}
