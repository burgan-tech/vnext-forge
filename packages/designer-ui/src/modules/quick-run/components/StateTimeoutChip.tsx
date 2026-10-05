import { useQuickRunStore } from '../store/quickRunStore';
import type { StateTimeout } from '../types/quickrun.types';
import { scheduleCountdownLabel } from '../utils/countdown';
import { normalizeTimeoutTarget, targetDisplayLabel } from '../utils/displayLabels';
import { AnnotationChips } from './AnnotationChips';

/** The armed workflow timeout of the polled instance (state function `timeout`). */
export function StateTimeoutChip({ timeout, nowMs }: { timeout?: StateTimeout; nowMs: number }) {
  const flowLabels = useQuickRunStore((s) => s.flowLabels);
  if (!timeout) return null;
  // Runtime ≤ 0.0.98 sends a state key, 0.0.99+ a target object — rendering
  // the object directly would throw.
  const target = normalizeTimeoutTarget(timeout);
  const label = scheduleCountdownLabel(timeout.executeAtUtc, nowMs);
  const at = Date.parse(timeout.executeAtUtc);
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-[11px]"
      title={Number.isNaN(at) ? 'Workflow timeout' : `Workflow timeout fires at ${new Date(at).toLocaleString()}`}
    >
      <span className="inline-flex items-center gap-1 rounded border border-warning-border bg-warning-surface px-1.5 py-0.5 text-warning-text">
        <span aria-hidden="true">⏱</span>
        <span className="font-mono">{timeout.key}</span>
        <span aria-hidden="true">→</span>
        {target && (
          <span className="font-mono" title={target.key}>
            {targetDisplayLabel(target, flowLabels)}
          </span>
        )}
        {label && <span className="opacity-80">· {label}</span>}
      </span>
      <AnnotationChips annotations={timeout.annotations} />
    </div>
  );
}
