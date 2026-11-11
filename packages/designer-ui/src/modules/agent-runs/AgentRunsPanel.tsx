import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

import { AgentCallErrorBox } from './AgentCallErrorBox';
import {
  agentRunStatusName,
  decisionSourceName,
  describeAgentCallFailure,
  describeAgentRuntimeError,
  getAgentRuns,
  statusTone,
  toolCallStatusName,
  type AgentCallError,
  type AgentRunRow,
  type AgentRunsResponse,
} from './AgentRunsApi';

export interface AgentRunsPanelProps {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
  /** Changes when the instance moves (state eTag); triggers a reload. */
  refreshToken?: string;
}

const PAGE = 20;

type AgentRunsAnswer = Awaited<ReturnType<typeof getAgentRuns>>;

/** The error of an agent-runs answer: the runtime's own (kept as data) or the Forge envelope's. */
function agentRunsError(response: AgentRunsAnswer, runtimeUrl?: string): AgentCallError | null {
  if (!response.success) return describeAgentCallFailure(response.error);
  const runtimeError = response.data.runtimeError;
  return runtimeError ? describeAgentRuntimeError(runtimeError, 'agentRuns', runtimeUrl) : null;
}

function thrownError(err: unknown): AgentCallError {
  return describeAgentCallFailure({ message: err instanceof Error ? err.message : String(err) });
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value as string | number | boolean);
}

function Chip({ label }: { label: string }) {
  if (!label) return null;
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${statusTone(label)}`}>{label}</span>;
}

/**
 * Agent runs of one instance (runtime 0.0.105 `functions/agent-runs`):
 * run → tool calls → decision, participant runs of multi-agent states,
 * `ApprovalPending` / `Denied` tool calls and the kept transcript.
 */
export function AgentRunsPanel({ domain, workflowKey, instanceId, headers, runtimeUrl, refreshToken }: AgentRunsPanelProps) {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AgentCallError | null>(null);
  const [take, setTake] = useState(PAGE);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    let failure: AgentCallError | null;
    let items: AgentRunRow[] = [];
    try {
      const response = await getAgentRuns({ domain, workflowKey, instanceId, take, headers, runtimeUrl });
      failure = agentRunsError(response, runtimeUrl);
      if (response.success) items = response.data.items ?? [];
    } catch (err) {
      failure = thrownError(err);
    }
    if (mine !== seq.current) return;
    setRuns(failure ? [] : items);
    setError(failure);
    setLoading(false);
  }, [domain, workflowKey, instanceId, take, headers, runtimeUrl]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Bot size={14} className="text-emerald-600" />
        <span className="text-foreground text-xs font-semibold">Agent runs</span>
        <span className="text-subtle text-[10px]">newest first</span>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Reload agent runs"
          className="text-muted-foreground hover:text-foreground ml-auto cursor-pointer rounded p-1">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {error && <AgentCallErrorBox error={error} />}
      {!error && !loading && runs.length === 0 && (
        <p className="text-muted-foreground text-[11px]">No agent runs for this instance yet.</p>
      )}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {runs.map((run) => {
          const id = text(run.id);
          const open = openRunId === id;
          const status = agentRunStatusName(run.status);
          return (
            <div key={id} className="border-border-subtle rounded-lg border">
              <button
                type="button"
                onClick={() => setOpenRunId(open ? null : id)}
                className="hover:bg-muted flex w-full cursor-pointer items-center gap-1.5 px-2 py-1.5 text-left text-[11px]">
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="font-mono font-semibold">{text(run.state)}</span>
                {run.participant ? (
                  <span className="bg-violet-500/10 rounded px-1 text-[9px] text-violet-700">{text(run.participant)}</span>
                ) : null}
                <span className="text-subtle font-mono">{text(run.agentKey)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <Chip label={status} />
                  {run.selectedTransition ? (
                    <span className="font-mono text-[10px]">→ {text(run.selectedTransition)}</span>
                  ) : null}
                </span>
              </button>
              {open && (
                <AgentRunDetail
                  run={run}
                  domain={domain}
                  workflowKey={workflowKey}
                  instanceId={instanceId}
                  headers={headers}
                  runtimeUrl={runtimeUrl}
                />
              )}
            </div>
          );
        })}
        {runs.length >= take && (
          <button
            type="button"
            onClick={() => setTake((t) => Math.min(t + PAGE, 100))}
            disabled={take >= 100}
            className="text-muted-foreground hover:text-foreground w-full cursor-pointer py-1 text-[11px] disabled:opacity-40">
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

function AgentRunDetail({
  run,
  domain,
  workflowKey,
  instanceId,
  headers,
  runtimeUrl,
}: {
  run: AgentRunRow;
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}) {
  const [detail, setDetail] = useState<AgentRunsResponse['detail']>(null);
  const [error, setError] = useState<AgentCallError | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAgentRuns({ domain, workflowKey, instanceId, runId: text(run.id), includeTranscript: true, headers, runtimeUrl })
      .then((response) => {
        if (cancelled) return;
        const failure = agentRunsError(response, runtimeUrl);
        if (failure) setError(failure);
        else if (response.success) setDetail(response.data.detail ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(thrownError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [domain, workflowKey, instanceId, run.id, headers, runtimeUrl]);

  const facts: [string, unknown][] = [
    ['Agent', `${text(run.agentKey)}@${text(run.agentVersion)}`],
    ['Provider', [run.providerKey, run.model].filter(Boolean).join(' · ')],
    ['Entry', run.entryNo],
    ['Decision', run.selectedTransition],
    ['Decided by', decisionSourceName(run.decisionSource)],
    ['Reason', run.decisionReason],
    ['Failure', run.failureReason],
    ['Iterations', run.iterations],
    ['Tool calls', run.toolCallCount],
    ['Tokens', run.totalTokens],
    ['Attempts', run.attempts],
    ['Duration', run.durationMs !== undefined ? `${text(run.durationMs)} ms` : ''],
    ['Session', run.sessionScopeKey ? `${text(run.sessionScopeKey)}${run.sessionResumed ? ' (resumed)' : ''}` : ''],
    ['Started', run.startedAt],
  ];

  return (
    <div className="border-border-subtle space-y-2 border-t px-2 py-2 text-[11px]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {facts
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-mono break-all">{text(v)}</dd>
            </div>
          ))}
      </dl>
      {error && <AgentCallErrorBox error={error} />}
      {detail && (
        <>
          <div>
            <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide">
              Tool calls ({detail.toolCalls.length})
            </div>
            {detail.toolCalls.length === 0 && <p className="text-subtle">No tool calls.</p>}
            <ol className="space-y-0.5">
              {detail.toolCalls.map((call) => {
                const status = toolCallStatusName(call.status);
                return (
                  <li key={text(call.id) || text(call.callId)} className="flex items-center gap-1.5">
                    <span className="text-subtle w-5 text-right tabular-nums">{text(call.sequence)}</span>
                    <span className="font-mono">{text(call.name)}</span>
                    <span className="text-subtle text-[10px]">kind {text(call.kind)}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <Chip label={status} />
                      {call.durationMs !== undefined && <span className="text-subtle text-[10px]">{text(call.durationMs)} ms</span>}
                    </span>
                    {call.error ? <span className="text-destructive-text basis-full pl-6">{text(call.error)}</span> : null}
                  </li>
                );
              })}
            </ol>
          </div>
          {detail.transcript !== undefined && detail.transcript !== null && (
            <div>
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-[10px] font-semibold tracking-wide">
                {showTranscript ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Transcript
              </button>
              {showTranscript && (
                <pre className="bg-muted-surface border-border mt-1 max-h-64 overflow-auto rounded-lg border p-2 font-mono text-[10px] whitespace-pre-wrap">
                  {JSON.stringify(detail.transcript, null, 2)}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
