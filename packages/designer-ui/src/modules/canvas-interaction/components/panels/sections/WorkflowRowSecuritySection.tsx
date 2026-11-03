import { useEffect, useState } from 'react';
import { Plus, Rows3, Trash2 } from 'lucide-react';
import {
  ROW_SECURITY_IDENTITY_ROLES,
  rowSecurityIssues,
  type RowSecurityIssue,
  type RowSecurityRule,
} from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { SCHEMA_0_0_58, SchemaFeatureHint } from '../../../../role-grants/SchemaFeatureHint';
import { useSchemaFeature } from '../../../../role-grants/useSchemaFeature';
import { MetadataSection } from './MetadataSection';

const inputClass =
  'w-full px-2.5 py-1.5 text-xs font-mono border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle';

const ROLE_SUGGESTIONS_ID = 'row-security-role-suggestions';

/**
 * Next value of `attributes.rowSecurity` for an edited rule list: `undefined`
 * (the key is removed, so the flow is unfiltered again) when no rule is left.
 * Exported for unit tests.
 */
export function nextRowSecurity(rules: RowSecurityRule[]): { rules: RowSecurityRule[] } | undefined {
  return rules.length > 0 ? { rules } : undefined;
}

/** Parses a rule's filter text: `undefined` filter for blank text, an error for anything but one JSON object. */
export function parseRowFilter(text: string): { filter?: Record<string, unknown>; error?: string } {
  if (text.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'Filter must be a single JSON object.' };
    if (Object.keys(parsed).length === 0) return { error: 'Filter object is empty; leave it blank to grant every row.' };
    return { filter: parsed as Record<string, unknown> };
  } catch {
    return { error: 'Filter is not valid JSON.' };
  }
}

function RuleFilterEditor({
  filter,
  onChange,
  disabled,
}: {
  filter: Record<string, unknown> | undefined;
  onChange: (filter: Record<string, unknown> | undefined) => void;
  disabled: boolean;
}) {
  const serialized = filter ? JSON.stringify(filter, null, 2) : '';
  const [text, setText] = useState(serialized);
  const [error, setError] = useState<string | undefined>();
  // Follow outside edits (undo, JSON editor) unless the draft is mid-edit and invalid.
  useEffect(() => {
    if (!error) setText(serialized);
  }, [serialized]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label className="text-muted-foreground text-[10px] font-semibold">Filter</label>
      <textarea
        value={text}
        disabled={disabled}
        rows={Math.min(8, Math.max(2, text.split('\n').length))}
        spellCheck={false}
        placeholder='{"attributes":{"branchCode":{"eq":"$.context.Headers.x-branch-code"}}}'
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseRowFilter(e.target.value);
          setError(parsed.error);
          if (!parsed.error) onChange(parsed.filter);
        }}
        className={inputClass}
        aria-label="Row filter"
      />
      {error ? (
        <p className="text-destructive-text mt-0.5 text-[10px]">{error}</p>
      ) : (
        <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
          Blank: these roles see every row (for {ROW_SECURITY_IDENTITY_ROLES.join(' / ')}: all of the caller's own
          instances).
        </p>
      )}
    </div>
  );
}

function RuleRolesEditor({
  roles,
  onChange,
  disabled,
}: {
  roles: string[];
  onChange: (roles: string[]) => void;
  disabled: boolean;
}) {
  const rows = roles.length > 0 ? roles : [''];
  return (
    <div>
      <label className="text-muted-foreground text-[10px] font-semibold">Roles</label>
      <div className="space-y-1">
        {rows.map((role, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={role}
              disabled={disabled}
              list={ROLE_SUGGESTIONS_ID}
              placeholder="branch-staff or $InstanceStarter"
              onChange={(e) => onChange(rows.map((r, j) => (j === i ? e.target.value : r)))}
              className={inputClass}
              aria-label={`Role ${i + 1}`}
            />
            {rows.length > 1 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive-text shrink-0 p-1"
                aria-label={`Remove role ${i + 1}`}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, ''])}
        className="text-primary-text mt-1 text-[10px] font-medium hover:underline">
        + Add role
      </button>
    </div>
  );
}

function IssueList({ issues }: { issues: RowSecurityIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {issues.map((issue, i) => (
        <li
          key={i}
          className={`text-[10px] leading-relaxed ${issue.severity === 'error' ? 'text-destructive-text' : 'text-warning-text'}`}>
          {issue.code}: {issue.message}
        </li>
      ))}
    </ul>
  );
}

/**
 * Workflow `attributes.rowSecurity` (runtime 0.0.102 / vnext-schema 0.0.58):
 * role-keyed row filters the runtime ANDs into instance reads. The inline
 * checks mirror the runtime's schema-independent publish codes; the runtime
 * publish stays authoritative for the master-schema-aware ones.
 */
export function WorkflowRowSecuritySection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const { supported, schemaVersion } = useSchemaFeature('workflow', 'attributes.rowSecurity');
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const rules: RowSecurityRule[] = Array.isArray(attrs.rowSecurity?.rules) ? attrs.rowSecurity.rules : [];
  const issues = rowSecurityIssues(workflowJson);
  // On an older project schema the editor stays visible but locked; rules
  // already in the file can still be removed.
  const locked = !supported && rules.length === 0;

  const writeRules = (next: RowSecurityRule[]) => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes) draft.attributes = {};
      const value = nextRowSecurity(next);
      if (value) draft.attributes.rowSecurity = value;
      else delete draft.attributes.rowSecurity;
    });
  };
  const updateRule = (index: number, patch: Partial<RowSecurityRule>) => {
    writeRules(
      rules.map((rule, i) => {
        if (i !== index) return rule;
        const next: RowSecurityRule = { ...rule, ...patch };
        if (next.filter === undefined) delete next.filter;
        return next;
      }),
    );
  };

  return (
    <MetadataSection
      title={`Row Security${rules.length > 0 ? ` (${rules.length})` : ''}`}
      icon={<Rows3 size={13} />}
      defaultOpen={rules.length > 0}>
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Role-keyed row filters for the instance list, the instance GET and the GetInstances / GetInstance tasks.
        </p>
        <p className="text-warning-text text-[10px] leading-relaxed">
          There is no default rule: once any rule exists, a caller whose roles match no rule sees no rows.
        </p>
        {!supported && <SchemaFeatureHint feature="Row security" schemaVersion={schemaVersion} minimum={SCHEMA_0_0_58} />}

        <IssueList issues={issues.filter((issue) => issue.ruleIndex === undefined)} />

        {rules.map((rule, index) => (
          <div key={index} className="border-border space-y-2 rounded-lg border p-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">Rule {index + 1}</span>
              <button
                type="button"
                onClick={() => writeRules(rules.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-destructive-text p-1"
                aria-label={`Remove rule ${index + 1}`}>
                <Trash2 size={12} />
              </button>
            </div>
            <RuleRolesEditor
              roles={Array.isArray(rule.roles) ? rule.roles : []}
              disabled={locked}
              onChange={(roles) => updateRule(index, { roles })}
            />
            <RuleFilterEditor filter={rule.filter} disabled={locked} onChange={(filter) => updateRule(index, { filter })} />
            <IssueList issues={issues.filter((issue) => issue.ruleIndex === index)} />
          </div>
        ))}

        <button
          type="button"
          disabled={locked}
          onClick={() => writeRules([...rules, { roles: [''] }])}
          className="text-primary-text flex items-center gap-1 text-[11px] font-medium hover:underline disabled:opacity-50">
          <Plus size={12} /> Add rule
        </button>

        <details className="text-muted-foreground text-[10px] leading-relaxed">
          <summary className="cursor-pointer">Filter parameters</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 font-mono">
            <li>$.context.Headers.&lt;name&gt; (gateway-written claim headers)</li>
            <li>$.context.QueryParameters.&lt;name&gt; (client-controlled: not for security decisions)</li>
            <li>$.context.CurrentUser.ActorUserName | ActorUserId | UserName | Position</li>
            <li>{'{ "$param": "$.context.Headers.x-branches", "split": "," }'} for in / nin / between</li>
            <li>$InstanceStarter on createdBy, $InstanceBehalfOfStarter on createdByBehalfOf</li>
          </ul>
        </details>

        <datalist id={ROLE_SUGGESTIONS_ID}>
          {ROW_SECURITY_IDENTITY_ROLES.map((role) => (
            <option key={role} value={role} />
          ))}
        </datalist>
      </div>
    </MetadataSection>
  );
}
