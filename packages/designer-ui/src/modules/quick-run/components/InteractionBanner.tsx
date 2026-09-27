import { remainingMs, type AwaitingAckPhase } from '../hooks/interactionMachine';
import { formatCountdown } from '../utils/countdown';
import { RuntimeErrorBanner } from './RuntimeErrorBanner';

export interface InteractionBannerProps {
  phase: AwaitingAckPhase;
  nowMs: number;
  onAcknowledge: () => void;
  onWaitForFallback: () => void;
}

const BUTTON = 'rounded border px-2 py-1 text-[10px] font-medium disabled:opacity-50';

/**
 * Long-poll interaction window (spec D3): the runtime paused after the
 * triggering transition; the user acknowledges now or lets the fallback fire.
 */
export function InteractionBanner({ phase, nowMs, onAcknowledge, onWaitForFallback }: InteractionBannerProps) {
  const left = remainingMs(phase, nowMs);
  const lead = phase.waitingForFallback
    ? 'Waiting for the fallback'
    : 'Acknowledge to continue now, or wait for the fallback';
  // While an acknowledge is in flight the outcome is unknown — no countdown
  // wording ("resumes in" / "resuming…") until it settles or the deadline
  // resumes the machine.
  const message = phase.acking
    ? 'The runtime paused after this transition. Sending the acknowledge…'
    : `The runtime paused after this transition. ${lead} — ${left > 0 ? `resumes in ${formatCountdown(left)}` : 'resuming…'}.`;
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded border border-warning-border bg-warning-surface px-3 py-2 text-[11px] text-warning-text"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Awaiting acknowledge</span>
        <span className="text-[var(--vscode-foreground)]">{message}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={`${BUTTON} border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]`}
            onClick={onAcknowledge}
            disabled={phase.acking}
          >
            {phase.acking ? 'Acknowledging…' : 'Acknowledge'}
          </button>
          {!phase.waitingForFallback && (
            <button
              type="button"
              className={`${BUTTON} border-[var(--vscode-panel-border)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]`}
              onClick={onWaitForFallback}
              disabled={phase.acking}
            >
              Wait for fallback
            </button>
          )}
        </div>
      </div>
      {phase.error && <RuntimeErrorBanner title="Acknowledge failed" error={phase.error} />}
    </section>
  );
}
