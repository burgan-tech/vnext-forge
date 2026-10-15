import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { readHistoryMode, subFlowChildRefs, type SubFlowChildRef } from '@vnext-forge-studio/vnext-types';

import { readOptionalFile } from '../../../../project-workspace/WorkspaceApi';
import { useWorkflowFileResolver } from '../../../../vnext-workspace/resolveWorkflowFileByKey';

/**
 * A `history: none` parent's SubFlow (`type: S`) children must be `none` too;
 * the runtime rejects the start otherwise (`Instance:100044`). SubProcess
 * children are exempt. Children that cannot be found locally are skipped.
 */
export function SubFlowHistoryWarning({ workflowJson }: { workflowJson: unknown }) {
  const resolveWorkflowFile = useWorkflowFileResolver();
  const none = readHistoryMode(workflowJson) === 'none';
  const refs = none ? subFlowChildRefs(workflowJson) : [];
  const refsKey = refs.map((r) => `${r.stateKey}|${r.domain ?? ''}|${r.key}`).join(',');
  const [offenders, setOffenders] = useState<SubFlowChildRef[]>([]);

  useEffect(() => {
    setOffenders([]);
    if (refs.length === 0) return;
    let cancelled = false;
    void (async () => {
      const found: SubFlowChildRef[] = [];
      for (const ref of refs) {
        const file = await resolveWorkflowFile(ref.key, ref.domain, { quiet: true }).catch(() => null);
        if (!file) continue;
        const content = await readOptionalFile(file.path);
        if (!content) continue;
        try {
          if (readHistoryMode(JSON.parse(content.content)) !== 'none') found.push(ref);
        } catch {
          // An unreadable child is reported by its own validation.
        }
      }
      if (!cancelled) setOffenders(found);
    })();
    return () => {
      cancelled = true;
    };
    // refsKey captures the refs' identity.
  }, [refsKey, resolveWorkflowFile]);

  if (offenders.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-warning-border bg-warning text-warning-foreground flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        SubFlow children must also use history: none, or the runtime rejects the start (Instance:100044):{' '}
        {offenders.map((o) => (
          <span key={o.stateKey} className="font-mono">
            {o.key} (state {o.stateKey}){' '}
          </span>
        ))}
        . Set their history to none or start them as a SubProcess (type P).
      </span>
    </div>
  );
}
