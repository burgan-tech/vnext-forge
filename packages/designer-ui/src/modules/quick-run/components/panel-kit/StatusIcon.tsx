import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, XCircle } from 'lucide-react';

import { TASK_OUTCOME_TEXT, type TaskOutcome } from './taskOutcome';

const ICONS: Record<TaskOutcome, { Icon: typeof CheckCircle2; className: string }> = {
  ok: { Icon: CheckCircle2, className: 'text-[var(--vscode-charts-green,#89d185)]' },
  failed: { Icon: XCircle, className: 'text-[var(--vscode-errorForeground,#f48771)]' },
  warning: { Icon: AlertTriangle, className: 'text-[var(--vscode-editorWarning-foreground,#cca700)]' },
  running: { Icon: Loader2, className: 'animate-spin text-[var(--vscode-progressBar-background)]' },
  unknown: { Icon: CircleHelp, className: 'text-[var(--vscode-descriptionForeground)]' },
};

/** One status icon (with an accessible name) shared by the Quick Run panels. */
export function StatusIcon({ outcome, size = 14, title }: { outcome: TaskOutcome; size?: number; title?: string }) {
  const { Icon, className } = ICONS[outcome];
  const label = title ?? TASK_OUTCOME_TEXT[outcome];
  return (
    <span className="inline-flex shrink-0" title={label} role="img" aria-label={label}>
      <Icon size={size} className={className} aria-hidden="true" />
    </span>
  );
}
