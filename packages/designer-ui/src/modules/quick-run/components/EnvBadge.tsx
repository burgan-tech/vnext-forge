interface EnvBadgeProps {
  name: string;
}

const ENV_COLORS: Record<string, string> = {
  DEV: 'bg-[var(--vscode-charts-blue)]',
  TEST: 'bg-[var(--vscode-charts-orange)]',
  PROD: 'bg-[var(--vscode-errorForeground)]',
};

export function EnvBadge({ name }: EnvBadgeProps) {
  const upper = name.toUpperCase();
  const colorClass = ENV_COLORS[upper] ?? 'bg-[var(--vscode-badge-background)]';

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${colorClass}`}
    >
      {upper}
    </span>
  );
}
