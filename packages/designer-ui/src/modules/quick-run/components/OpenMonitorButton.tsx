import { Activity } from 'lucide-react';

/** Header action next to "Instance Details". */
export function OpenMonitorButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
      title="Monitor this instance"
      aria-label="Monitor this instance"
      onClick={onClick}
    >
      <Activity size={12} aria-hidden />
    </button>
  );
}
