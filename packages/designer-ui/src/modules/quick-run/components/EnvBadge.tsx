interface EnvBadgeProps {
  name: string;
}

const ENV_STYLES: Record<string, string> = {
  DEV: 'border-info-border bg-info text-info-foreground',
  TEST: 'border-warning-border bg-warning text-warning-foreground',
  PROD: 'border-destructive-border bg-destructive-muted text-destructive-text',
};

export function EnvBadge({ name }: EnvBadgeProps) {
  const upper = name.toUpperCase();
  const styleClass =
    ENV_STYLES[upper] ?? 'border-muted-border bg-muted text-muted-foreground';

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${styleClass}`}
    >
      {upper}
    </span>
  );
}
