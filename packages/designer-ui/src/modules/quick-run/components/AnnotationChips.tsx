/** Key/value chips for transition / timeout `annotations` (client UI metadata). */
export function AnnotationChips({
  annotations,
  className = '',
}: {
  annotations?: Record<string, string> | null;
  className?: string;
}) {
  const entries = annotations ? Object.entries(annotations) : [];
  if (entries.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="rounded bg-[var(--vscode-badge-background)] px-1 py-0.5 text-[9px] text-[var(--vscode-badge-foreground)]"
        >
          <span className="font-semibold">{key}</span>: {value}
        </span>
      ))}
    </span>
  );
}
