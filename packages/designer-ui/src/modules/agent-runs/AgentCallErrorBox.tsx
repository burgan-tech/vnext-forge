import type { AgentCallError } from './AgentRunsApi';

/** The failure of an AI Agent runtime call: status and code, the runtime's message, a hint. */
export function AgentCallErrorBox({ error }: { error: AgentCallError }) {
  return (
    <div
      role="alert"
      className="border-destructive-border bg-destructive-surface text-destructive-text space-y-1 rounded-lg border px-2.5 py-1.5 text-[11px]">
      <div className="font-mono text-[10px] font-semibold">{error.title}</div>
      {error.detail && <p className="text-foreground">{error.detail}</p>}
      {error.hint && <p>{error.hint}</p>}
      {error.traceId && <p className="text-subtle font-mono text-[9px]">trace {error.traceId}</p>}
    </div>
  );
}
