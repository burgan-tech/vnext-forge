import { memo, useEffect, useState } from 'react';
import { Check, CircleDashed, AlertCircle } from 'lucide-react';

interface SaveStatusIndicatorProps {
  isDirty: boolean;
  /** Set by the workflow-save layer when a save kicks off. */
  saving?: boolean;
  /** Set when the last save failed; cleared on next success. */
  saveError?: string | null;
  /** Last successful save timestamp (ms epoch). */
  lastSavedAt?: number | null;
}

/**
 * Tiny status chip rendered top-right of the canvas. Reflects
 * the workflow save state at a glance:
 *
 *   - "Saving…"          — a save is in flight (yellow spinner)
 *   - "Unsaved changes"  — dirty buffer (amber dot)
 *   - "Saved 3s ago"     — fresh save (green check); relative
 *                          time tick updates every 10s
 *   - "Save failed"      — last save returned an error (red)
 *
 * Times use coarse relative formatting ("just now", "Ns ago",
 * "Nm ago", "Nh ago") so the chip stays narrow.
 */
export const SaveStatusIndicator = memo(function SaveStatusIndicator({
  isDirty,
  saving,
  saveError,
  lastSavedAt,
}: SaveStatusIndicatorProps) {
  // Force a re-render every 10s so the "Saved Xs ago" string stays
  // current without the parent having to push tick events.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt || isDirty || saving) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, [lastSavedAt, isDirty, saving]);

  let icon: React.ReactNode;
  let label: string;
  let tone: 'good' | 'warn' | 'busy' | 'error' = 'good';

  if (saveError) {
    icon = <AlertCircle size={11} />;
    label = 'Save failed';
    tone = 'error';
  } else if (saving) {
    icon = <CircleDashed size={11} className="animate-spin" />;
    label = 'Saving…';
    tone = 'busy';
  } else if (isDirty) {
    icon = <span className="size-1.5 rounded-full bg-amber-500" />;
    label = 'Unsaved changes';
    tone = 'warn';
  } else if (lastSavedAt) {
    icon = <Check size={11} />;
    label = `Saved ${formatRelative(Date.now() - lastSavedAt)}`;
    tone = 'good';
  } else {
    icon = <Check size={11} />;
    label = 'Saved';
    tone = 'good';
  }

  const toneClasses = {
    good: 'text-emerald-700 bg-emerald-100/70 border-emerald-300/40 dark:text-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700/40',
    warn: 'text-amber-800 bg-amber-100/70 border-amber-300/40 dark:text-amber-200 dark:bg-amber-900/30 dark:border-amber-700/40',
    busy: 'text-sky-800 bg-sky-100/70 border-sky-300/40 dark:text-sky-200 dark:bg-sky-900/30 dark:border-sky-700/40',
    error:
      'text-rose-800 bg-rose-100/70 border-rose-300/40 dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/40',
  }[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      // `absolute` instead of `fixed` so the chip pins to the
      // canvas wrapper (which is relative-positioned), not the
      // browser viewport. Keeps the chip out of the host shell's
      // topbar where the "Modified" pill + undo/redo/save buttons
      // live. The parent canvas wrapper has `position: relative`
      // for exactly this reason.
      className={`absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium shadow-sm backdrop-blur-md ${toneClasses}`}
    >
      <span className="flex items-center">{icon}</span>
      <span>{label}</span>
    </div>
  );
});

function formatRelative(deltaMs: number): string {
  const s = Math.max(0, Math.floor(deltaMs / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
