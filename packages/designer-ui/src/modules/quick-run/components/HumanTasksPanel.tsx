import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWorkflowFileResolver } from '../../vnext-workspace/resolveWorkflowFileByKey';
import { useOpenInstance } from '../hooks/useOpenInstance';
import { quickRunHeadersFromState } from '../pseudo-ui/mergeQuickRunHeaders';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import type { HumanTaskItem, OpenSubFlowTarget } from '../types/quickrun.types';
import { currentRoleFromHeaders, withRoleHeaders } from '../utils/currentRole';
import { humanTaskOpenAction, instanceTargetFromHumanTask } from '../utils/humanTasks';
import { HumanTaskList } from './HumanTaskList';
import type { RuntimeErrorLike } from './RuntimeErrorBanner';

const INPUT =
  'min-w-0 flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[10px] text-[var(--vscode-input-foreground)]';

/** Which human tasks may this role act on in this domain. */
export function HumanTasksPanel({ onOpenSubFlowTarget }: { onOpenSubFlowTarget?: (target: OpenSubFlowTarget) => void }) {
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const sessionHeaders = useQuickRunStore((s) => s.sessionHeaders);
  const toolWideHeaders = useQuickRunStore((s) => s.toolWideHeaders);
  const environmentUrl = useQuickRunStore((s) => s.environmentUrl);
  const openInstance = useOpenInstance();
  const resolveWorkflowFile = useWorkflowFileResolver();

  // The shared Quick Run header rule (tool-wide < global < session).
  const baseHeaders = useMemo(
    () => quickRunHeadersFromState({ globalHeaders, sessionHeaders, toolWideHeaders }),
    [globalHeaders, sessionHeaders, toolWideHeaders],
  );
  const [role, setRole] = useState(() => currentRoleFromHeaders(baseHeaders) ?? '');
  const [cacheOverride, setCacheOverride] = useState(false);
  const [rows, setRows] = useState<HumanTaskItem[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RuntimeErrorLike | null>(null);

  const load = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    try {
      const res = await QuickRunApi.getHumanTasks({
        domain,
        cacheOverride,
        headers: withRoleHeaders(baseHeaders, role),
        runtimeUrl: environmentUrl,
      });
      if (res.success) {
        setRows(res.data.items);
        setTruncated(res.data.truncated);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError({ code: 'RUNTIME_CONNECTION_FAILED', message: err instanceof Error ? err.message : 'Could not reach the runtime.' });
    } finally {
      setLoading(false);
    }
  }, [domain, cacheOverride, baseHeaders, role, environmentUrl]);

  // Load once per domain/runtime; later refreshes are explicit (Refresh button).
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    void loadRef.current();
  }, [domain, environmentUrl]);

  const handleOpen = useCallback(
    (row: HumanTaskItem) => {
      if (humanTaskOpenAction(row, workflowKey) === 'openInstance') {
        openInstance(instanceTargetFromHumanTask(row, domain, workflowKey));
        return;
      }
      const target = row.workflow;
      if (!onOpenSubFlowTarget || !target) return;
      void resolveWorkflowFile(target, domain).then((resolved) => {
        if (!resolved) return;
        onOpenSubFlowTarget({
          intent: 'quickrun',
          domain,
          workflowKey: target,
          workflowFilePath: resolved.path,
          ...(resolved.route ? { route: resolved.route } : {}),
        });
      });
    },
    [workflowKey, domain, openInstance, onOpenSubFlowTarget, resolveWorkflowFile],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1.5 border-b border-[var(--vscode-panel-border)] px-3 py-2">
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--vscode-descriptionForeground)]" htmlFor="quickrun-ht-role">
            Role
          </label>
          <input
            id="quickrun-ht-role"
            className={INPUT}
            value={role}
            placeholder="From headers"
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
          />
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
          <input type="checkbox" checked={cacheOverride} onChange={(e) => setCacheOverride(e.target.checked)} />
          Bypass the runtime cache
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HumanTaskList
          rows={rows}
          truncated={truncated}
          loading={loading}
          error={error}
          currentWorkflowKey={workflowKey}
          canOpenOtherWorkflows={!!onOpenSubFlowTarget}
          onOpen={handleOpen}
        />
      </div>
    </div>
  );
}
