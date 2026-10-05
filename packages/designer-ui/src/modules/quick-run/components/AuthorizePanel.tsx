import { useRef, useState } from 'react';

import type { AuthorizeTarget } from '../types/quickrun.types';
import {
  authorizeVerdictScope,
  buildAuthorizeTarget,
  verdictText,
  visibilityText,
  type AuthorizeVerdict,
} from '../utils/permissionChecks';

export interface AuthorizePanelProps {
  transitionKeys: readonly string[];
  functionKeys: readonly string[];
  defaultRole?: string;
  onRun: (request: { target: AuthorizeTarget; role?: string; version?: string }) => Promise<AuthorizeVerdict>;
  checksEnabled: boolean;
  onChecksEnabledChange: (enabled: boolean) => void;
  /** `queryRoles` verdict of the opt-in checks for the current role. */
  visibility?: AuthorizeVerdict;
  /** The active state's eTag — a manual verdict is cleared when it moves. */
  stateETag?: string;
}

const TARGETS: { value: AuthorizeTarget['kind']; label: string }[] = [
  { value: 'transition', label: 'Transition' },
  { value: 'function', label: 'Function' },
  { value: 'queryRoles', label: 'Instance visibility (queryRoles)' },
  { value: 'ack', label: 'Acknowledge (ack)' },
];

const INPUT =
  'rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[10px] text-[var(--vscode-input-foreground)]';

function VerdictChip({ verdict }: { verdict: AuthorizeVerdict }) {
  const tone =
    verdict.kind === 'error'
      ? 'border-warning-border bg-warning-surface text-warning-text'
      : verdict.allowed
        ? 'border-success-border bg-success text-success-foreground'
        : 'border-destructive-border bg-destructive-muted text-destructive-text';
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{verdictText(verdict)}</span>;
}

/** Ask the runtime's `authorize` oracle about the active instance (spec D4). */
export function AuthorizePanel({
  transitionKeys,
  functionKeys,
  defaultRole,
  onRun,
  checksEnabled,
  onChecksEnabledChange,
  visibility,
  stateETag,
}: AuthorizePanelProps) {
  const [kind, setKind] = useState<AuthorizeTarget['kind']>('transition');
  const [key, setKey] = useState('');
  const [role, setRole] = useState(defaultRole ?? '');
  const [version, setVersion] = useState('');
  const [running, setRunning] = useState(false);
  const [verdict, setVerdict] = useState<AuthorizeVerdict | null>(null);

  // A manual verdict answers a question about one state and its keys: drop
  // it when the state eTag or the available transition/function keys change,
  // and ignore a request that was still in flight across that change.
  const scope = authorizeVerdictScope(stateETag, transitionKeys, functionKeys);
  const [verdictScope, setVerdictScope] = useState(scope);
  if (verdictScope !== scope) {
    setVerdictScope(scope);
    setVerdict(null);
  }
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const options = kind === 'transition' ? transitionKeys : kind === 'function' ? functionKeys : [];
  const selectedKey = options.includes(key) ? key : (options[0] ?? '');
  const target = buildAuthorizeTarget(kind, selectedKey);

  const run = async () => {
    if (!target) return;
    setRunning(true);
    const runScope = scope;
    try {
      const result = await onRun({
        target,
        ...(role.trim() ? { role: role.trim() } : {}),
        ...(version.trim() ? { version: version.trim() } : {}),
      });
      if (scopeRef.current === runScope) setVerdict(result);
    } finally {
      setRunning(false);
    }
  };

  return (
    <details className="rounded border border-[var(--vscode-panel-border)] p-3 text-xs">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase text-muted-text">
        Authorization
        {checksEnabled && visibility && (
          <span className="text-[10px] font-normal normal-case text-[var(--vscode-descriptionForeground)]">
            · {visibilityText(visibility)}
          </span>
        )}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={checksEnabled}
            onChange={(e) => onChecksEnabledChange(e.target.checked)}
          />
          Check permissions for role{defaultRole ? ` "${defaultRole}"` : ''}
        </label>
        <div className="flex flex-wrap items-center gap-1">
          <select
            className={INPUT}
            aria-label="Target"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as AuthorizeTarget['kind']);
              setVerdict(null);
            }}
          >
            {TARGETS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {(kind === 'transition' || kind === 'function') && (
            <select
              className={INPUT}
              aria-label="Key"
              value={selectedKey}
              onChange={(e) => {
                setKey(e.target.value);
                setVerdict(null);
              }}
            >
              {options.length === 0 && <option value="">(none available)</option>}
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          <input
            className={`w-24 ${INPUT}`}
            aria-label="Role"
            placeholder="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <input
            className={`w-20 ${INPUT}`}
            aria-label="Version"
            placeholder="Version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <button
            type="button"
            className="rounded bg-[var(--vscode-button-background)] px-2 py-1 text-[10px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
            onClick={() => void run()}
            disabled={!target || running}
          >
            {running ? 'Running…' : 'Run'}
          </button>
          {verdict && <VerdictChip verdict={verdict} />}
        </div>
        {kind === 'queryRoles' && (
          <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">
            Runtime 0.0.99+ decides instance visibility at the deepest active SubFlow only (parent override, else the
            leaf state's or leaf workflow's queryRoles). Grants may combine roles with allOf / anyOf.
          </p>
        )}
      </div>
    </details>
  );
}
