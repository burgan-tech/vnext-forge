import { useMemo, useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { resolveAgentCandidates } from '@vnext-forge-studio/vnext-types';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/Dialog';
import { useToolHeadersStore } from '../../store/useToolHeadersStore';
import { isRecord, type Json } from '../agent-editor/agentDocument';
import { JsonObjectField, TextAreaField, TextField, ToggleField } from '../agent-editor/components/agentFormPrimitives';
import {
  agentDryRun,
  statusTone,
  toolCallStatusName,
  type AgentDryRunResult,
} from './AgentRunsApi';

export interface AgentDryRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The `sys-agents` reference (`key`, `domain`, `version`). */
  agentRef: Json;
  /** The AI Agent state, when run from the state tab: seeds the prompt and the candidates. */
  state?: Json;
  /** Parsed agent component, when known (shows its output schema). */
  agentJson?: Json;
}

/**
 * Runtime dry run of an agent (`POST {domain}/definitions/agents/{key}/dry-run`,
 * runtime 0.0.105): one run on sample data with stub tools, no instance, no
 * session. The runtime allows it only for the caller roles in
 * `AiAgent:DryRun:Roles`; the role travels in the Forge-wide tool headers.
 */
export function AgentDryRunDialog({ open, onOpenChange, agentRef, state, agentJson }: AgentDryRunDialogProps) {
  const toolHeaders = useToolHeadersStore((s) => s.headers);
  const agentKey = typeof agentRef.key === 'string' ? agentRef.key : '';
  const domain = typeof agentRef.domain === 'string' ? agentRef.domain : '';

  const seededPrompt = useMemo(() => {
    const prompt = isRecord(state?.agent) && isRecord((state.agent).prompt) ? ((state.agent).prompt) : {};
    return typeof prompt.template === 'string' ? prompt.template : '';
  }, [state]);
  const candidates = useMemo(() => (state ? resolveAgentCandidates(state).candidates : []), [state]);

  const [prompt, setPrompt] = useState(seededPrompt);
  const [version, setVersion] = useState<string | undefined>(
    typeof agentRef.version === 'string' ? agentRef.version : undefined,
  );
  const [data, setData] = useState<Record<string, unknown> | undefined>({});
  const [sendCandidates, setSendCandidates] = useState(candidates.length > 0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentDryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await agentDryRun({
        domain,
        agentKey,
        ...(version ? { version } : {}),
        prompt,
        data: data ?? {},
        ...(sendCandidates && candidates.length > 0
          ? { candidates: candidates.map(({ key, when, whenSource }) => ({ key, when, whenSource })) }
          : {}),
        ...(Object.keys(toolHeaders).length > 0 ? { headers: toolHeaders } : {}),
      });
      if (response.success) setResult(response.data);
      else setError(response.error.message || 'The dry run failed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="secondary"
        className="border-border bg-surface text-foreground gap-0 p-0 shadow-sm sm:max-w-2xl"
        showCloseButton
        closeButtonHoverable
        hoverable={false}>
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2 text-base font-semibold tracking-tight">
            <FlaskConical size={16} /> Dry run · {agentKey || 'agent'}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-muted-foreground px-4 text-xs leading-relaxed">
          Runs the published agent once on sample data: no instance, no session, every tool answers a stub. The runtime allows
          it only for roles listed in <code>AiAgent:DryRun:Roles</code>; send your role in the tool headers.
        </DialogDescription>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide">Domain</div>
              <div className="border-border bg-muted-surface rounded-lg border px-2.5 py-1.5 font-mono text-xs">{domain || '—'}</div>
            </div>
            <TextField label="Agent version" hint="Latest when empty." value={version} onChange={setVersion} mono />
          </div>
          <TextAreaField
            label="Prompt"
            hint="Sent as is; template placeholders are not rendered by a dry run."
            value={prompt}
            onChange={(v) => setPrompt(v ?? '')}
            rows={4}
            mono
          />
          <JsonObjectField label="Sample data" value={data} onChange={setData} rows={5} />
          {candidates.length > 0 && (
            <div className="border-border-subtle space-y-1 rounded-lg border p-2">
              <ToggleField
                label={`Send the state’s ${candidates.length} candidates`}
                hint="The model then also returns a decision among them."
                checked={sendCandidates}
                onChange={setSendCandidates}
              />
              <ul className="text-muted-foreground pl-6 text-[10px]">
                {candidates.map((c) => (
                  <li key={c.key}>
                    <span className="text-foreground font-mono">{c.key}</span> — {c.when}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Object.keys(toolHeaders).length > 0 && (
            <p className="text-subtle text-[10px]">Headers: {Object.keys(toolHeaders).join(', ')}</p>
          )}

          <button
            type="button"
            onClick={() => void run()}
            disabled={running || !agentKey || !domain}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            {running ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Run
          </button>

          {error && (
            <p className="border-destructive-border bg-destructive-surface text-destructive-text rounded-lg border px-2.5 py-1.5 text-[11px]">
              {error}
            </p>
          )}
          {result && <DryRunResult result={result} schema={agentJson} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DryRunResult({ result, schema }: { result: AgentDryRunResult; schema?: Json }) {
  const outputSchema =
    schema && isRecord(schema.attributes) && isRecord((schema.attributes).output)
      ? ((schema.attributes).output).schema
      : undefined;
  return (
    <div className="border-border-subtle space-y-2 rounded-lg border p-2.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusTone(result.status)}`}>
          {result.status}
        </span>
        {result.decision && <span className="font-mono">→ {result.decision}</span>}
        <span className="text-subtle ml-auto">
          {[
            result.durationMs !== undefined ? `${result.durationMs} ms` : '',
            result.promptTokens !== undefined ? `${result.promptTokens} prompt tokens` : '',
            result.completionTokens !== undefined ? `${result.completionTokens} completion tokens` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      {result.reason && <p>Reason: {result.reason}</p>}
      {result.failureReason && <p className="text-destructive-text">Failure: {result.failureReason}</p>}
      <div>
        <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide">Output</div>
        <pre className="bg-muted-surface border-border max-h-60 overflow-auto rounded-lg border p-2 font-mono text-[10px] whitespace-pre-wrap">
          {JSON.stringify(result.output ?? null, null, 2)}
        </pre>
        {outputSchema !== undefined && (
          <p className="text-subtle mt-1 text-[10px]">Validated by the runtime against the agent’s output schema.</p>
        )}
      </div>
      <div>
        <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide">
          Tool calls ({result.toolCalls.length}, stubbed)
        </div>
        <ol className="space-y-0.5">
          {result.toolCalls.map((call, i) => (
            <li key={typeof call.callId === 'string' ? call.callId : String(i)} className="flex items-center gap-1.5">
              <span className="font-mono">{typeof call.name === 'string' ? call.name : ''}</span>
              <span className={`ml-auto rounded px-1 text-[9px] uppercase ${statusTone(toolCallStatusName(call.status))}`}>
                {toolCallStatusName(call.status)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
