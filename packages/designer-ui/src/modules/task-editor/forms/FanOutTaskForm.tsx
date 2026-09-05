import { useMemo, useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type { ErrorBoundary } from '@vnext-forge-studio/vnext-types';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { RadioCard, RadioCardGroup } from '../../../ui/RadioCard';
import { useProjectStore } from '../../../store/useProjectStore';
import {
  ChooseExistingTaskDialog,
  ChooseFromExistingVnextComponentButton,
} from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import { ErrorBoundaryEditor } from '../../canvas-interaction/components/panels/tabs/shared/ErrorBoundaryEditor';
import {
  FAN_OUT_DEFAULTS,
  FAN_OUT_JOIN_POLICIES,
  validateFanOutConfig,
  type FanOutJoinPolicyValue,
} from './fanOutConfigRules';

interface Props {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
  taskKey?: string;
}

type ItemSource = 'path' | 'selector';

const JOIN_POLICY_HELP: Record<FanOutJoinPolicyValue, string> = {
  all: 'Succeeds only when every item succeeds and the batch did not time out; the first failure cancels the rest. An empty batch succeeds.',
  allSettled: 'Always succeeds — partial failure is data, not an error. Branch on {resultKey}Summary.failed downstream. An empty batch succeeds.',
  quorum: 'Succeeds when at least minSuccess items succeed. An empty batch fails.',
  firstSuccess: 'Succeeds on the first successful item and cancels the rest. An empty batch fails.',
};

function Warning({ text }: { text: string | undefined }) {
  if (!text) return null;
  return <p className="text-[11px] text-warning-text">{text}</p>;
}

function numberOrUndefined(raw: string): number | undefined {
  if (raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * FanOut task (type 21) config form. Runs the inner `task` once per item of a
 * runtime-resolved collection, in parallel, then joins the outcomes into one
 * result. The per-item mapping (`IFanOutMapping` .csx) is NOT a property of the
 * task component — it lives on the task binding inside the workflow — so this
 * form deliberately offers no script editor.
 */
export function FanOutTaskForm({ config, onChange }: Props) {
  const task = (config.task as Record<string, unknown> | undefined) ?? {};
  const execution = (config.execution as Record<string, unknown> | undefined) ?? {};
  const join = (config.join as Record<string, unknown> | undefined) ?? {};
  const policy = (typeof join.policy === 'string' ? join.policy : FAN_OUT_DEFAULTS.joinPolicy) as FanOutJoinPolicyValue;

  const { errors, warnings } = useMemo(() => validateFanOutConfig(config), [config]);

  // The XOR has two legs: a fixed `itemsPath`, or an `ItemSelector` override in
  // the workflow mapping (which means no `itemsPath` at all). We remember the
  // author's choice locally so switching to "selector" clears the path and
  // switching back does not immediately error on an empty field.
  const [itemSource, setItemSource] = useState<ItemSource>(() =>
    typeof config.itemsPath === 'string' && config.itemsPath !== '' ? 'path' : 'selector',
  );

  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const [pickerOpen, setPickerOpen] = useState(false);
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  const setTaskField = (field: string, value: string) =>
    onChange((d: any) => {
      const t = (d.task as Record<string, unknown>) ?? {};
      t[field] = value || undefined;
      d.task = t;
    });

  const setNested = (section: 'execution' | 'join', field: string, value: unknown) =>
    onChange((d: any) => {
      const s = (d[section] as Record<string, unknown>) ?? {};
      if (value === undefined) delete s[field];
      else s[field] = value;
      d[section] = Object.keys(s).length > 0 ? s : undefined;
    });

  const handlePickTask = (component: DiscoveredVnextComponent) => {
    onChange((d: any) => {
      d.task = {
        key: component.key,
        domain: projectDomain || undefined,
        flow: component.flow || 'sys-tasks',
        version: component.version || undefined,
      };
    });
  };

  const handleItemSource = (next: ItemSource) => {
    setItemSource(next);
    if (next === 'selector') onChange((d: any) => { d.itemsPath = undefined; });
  };

  return (
    <div className="space-y-4">
      {/* ── Item source ─────────────────────────────────────────────── */}
      <div className="rounded-md border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-primary-text/75">Item Source</span>
          <span
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-primary-text/60"
            title="Only inline mode is supported by the runtime: the whole batch runs synchronously inside the transition that triggered it.">
            Mode: inline
          </span>
        </div>
        <RadioCardGroup
          value={itemSource}
          onValueChange={(v) => handleItemSource(String(v) as ItemSource)}
          aria-label="Item source"
          className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <RadioCard
            value="path"
            label="Items path"
            description="A fixed “$.”-rooted path into instance data that resolves to an array."
            className="h-auto min-h-0 w-full [&>span]:px-2.5 [&>span]:py-1.5"
          />
          <RadioCard
            value="selector"
            label="Item selector in mapping"
            description="The workflow's task binding mapping overrides ItemSelector and computes the list."
            className="h-auto min-h-0 w-full [&>span]:px-2.5 [&>span]:py-1.5"
          />
        </RadioCardGroup>
        {itemSource === 'path' ? (
          <Field
            label="Items Path"
            required
            hint="Property navigation only (e.g. $.documents.online). No filters, wildcards, indices or slices. A missing path resolves to an empty batch."
            errorMsg={errors.itemsPath}>
            <Input
              type="text"
              value={String(config.itemsPath || '')}
              onChange={(e) => onChange((d: any) => { d.itemsPath = e.target.value || undefined; })}
              placeholder="$.documents"
              size="sm"
              inputClassName="font-mono text-xs"
            />
          </Field>
        ) : (
          <p className="text-[10px] text-primary-text/65">
            No <code>itemsPath</code> is written. The mapping attached where this task is bound in a workflow must
            override <code>ItemSelector</code>; setting both is rejected by the runtime.
          </p>
        )}
        <Field
          label="Item Label (logs/traces)"
          hint="Reporting label only — it plays no role in input binding. Defaults to “item”.">
          <Input
            type="text"
            value={String(config.itemAlias || '')}
            onChange={(e) => onChange((d: any) => { d.itemAlias = e.target.value || undefined; })}
            placeholder="item"
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
      </div>

      {/* ── Inner task ──────────────────────────────────────────────── */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-primary-text/75">Inner Task</span>
          <ChooseFromExistingVnextComponentButton
            category="tasks"
            onClick={() => setPickerOpen(true)}
            disabled={!canPickExisting}
            label="Choose existing task"
            title={
              canPickExisting
                ? 'Pick a task from workspace JSON files'
                : 'Requires an open project and vnext.config.json with paths'
            }
          />
        </div>
        <p className="text-[10px] text-primary-text/65">
          Run once per item. Resolved once per batch and cloned per item. Must not be another Fan-Out task (a nested
          batch deadlocks against the shared bulkhead); Human and Timer tasks cannot finish inside the item timeout.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(['key', 'domain', 'flow', 'version'] as const).map((field) => (
            <Field
              key={field}
              label={field.charAt(0).toUpperCase() + field.slice(1)}
              required
              errorMsg={errors[`task.${field}`]}>
              <Input
                type="text"
                value={String(task[field] || '')}
                onChange={(e) => setTaskField(field, e.target.value)}
                placeholder={field === 'flow' ? 'sys-tasks' : undefined}
                size="sm"
                inputClassName="font-mono text-xs"
              />
            </Field>
          ))}
        </div>
        <ChooseExistingTaskDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelectTask={handlePickTask} />
      </div>

      {/* ── Execution ───────────────────────────────────────────────── */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <span className="text-xs font-semibold text-primary-text/75">Execution</span>
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Max Parallelism"
            hint={`Batch-local cap. Default ${FAN_OUT_DEFAULTS.maxDegreeOfParallelism}.`}
            errorMsg={errors['execution.maxDegreeOfParallelism']}>
            <Input
              type="number"
              min={1}
              step={1}
              value={execution.maxDegreeOfParallelism == null ? '' : Number(execution.maxDegreeOfParallelism)}
              onChange={(e) => setNested('execution', 'maxDegreeOfParallelism', numberOrUndefined(e.target.value))}
              placeholder={String(FAN_OUT_DEFAULTS.maxDegreeOfParallelism)}
              size="sm"
              inputClassName="text-xs"
            />
            <Warning text={warnings['execution.maxDegreeOfParallelism']} />
          </Field>
          <Field
            label="Item Timeout (s)"
            hint={`Per-item deadline. Default ${FAN_OUT_DEFAULTS.itemTimeoutSeconds}.`}
            errorMsg={errors['execution.itemTimeoutSeconds']}>
            <Input
              type="number"
              min={1}
              step={1}
              value={execution.itemTimeoutSeconds == null ? '' : Number(execution.itemTimeoutSeconds)}
              onChange={(e) => setNested('execution', 'itemTimeoutSeconds', numberOrUndefined(e.target.value))}
              placeholder={String(FAN_OUT_DEFAULTS.itemTimeoutSeconds)}
              size="sm"
              inputClassName="text-xs"
            />
          </Field>
          <Field
            label="Batch Timeout (s)"
            hint={`Whole-batch deadline. Default ${FAN_OUT_DEFAULTS.batchTimeoutSeconds}.`}
            errorMsg={errors['execution.batchTimeoutSeconds']}>
            <Input
              type="number"
              min={1}
              step={1}
              value={execution.batchTimeoutSeconds == null ? '' : Number(execution.batchTimeoutSeconds)}
              onChange={(e) => setNested('execution', 'batchTimeoutSeconds', numberOrUndefined(e.target.value))}
              placeholder={String(FAN_OUT_DEFAULTS.batchTimeoutSeconds)}
              size="sm"
              inputClassName="text-xs"
            />
          </Field>
        </div>
      </div>

      {/* ── Join ────────────────────────────────────────────────────── */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <span className="text-xs font-semibold text-primary-text/75">Join</span>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Join Policy" hint={JOIN_POLICY_HELP[policy] ?? undefined} errorMsg={errors['join.policy']}>
            <Select
              value={typeof join.policy === 'string' ? join.policy : ''}
              onChange={(e) => setNested('join', 'policy', e.target.value || undefined)}
              className="text-xs">
              <option value="">Default ({FAN_OUT_DEFAULTS.joinPolicy})</option>
              {FAN_OUT_JOIN_POLICIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
            <Warning text={warnings['join.policy']} />
          </Field>
          <Field
            label="Result Key"
            hint={`Instance-data key for the default output packaging. Default ${FAN_OUT_DEFAULTS.resultKey}. Ignored when the mapping overrides OutputHandler.`}
            errorMsg={errors['join.resultKey']}>
            <Input
              type="text"
              value={String(join.resultKey ?? '')}
              onChange={(e) => setNested('join', 'resultKey', e.target.value === '' ? undefined : e.target.value)}
              placeholder={FAN_OUT_DEFAULTS.resultKey}
              size="sm"
              inputClassName="font-mono text-xs"
            />
          </Field>
        </div>
        {(policy === 'quorum' || join.minSuccess !== undefined) && (
          <Field
            label="Min Success"
            required={policy === 'quorum'}
            hint="Minimum number of successful items for the batch to succeed."
            errorMsg={errors['join.minSuccess']}>
            <Input
              type="number"
              min={1}
              step={1}
              value={join.minSuccess == null ? '' : Number(join.minSuccess)}
              onChange={(e) => setNested('join', 'minSuccess', numberOrUndefined(e.target.value))}
              size="sm"
              inputClassName="text-xs"
            />
            <Warning text={warnings['join.minSuccess']} />
          </Field>
        )}
      </div>

      {/* ── Per-item error boundary ─────────────────────────────────── */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <span className="text-xs font-semibold text-primary-text/75">Per-item error boundary</span>
        <p className="text-[10px] text-primary-text/65">
          Applied independently to every item. A rule that ignores 4xx lets one item be skipped without stopping the
          batch. A catch-all “*” + Ignore hides real failures behind allSettled.
        </p>
        <ErrorBoundaryEditor
          errorBoundary={config.errorBoundary as ErrorBoundary | undefined}
          onChange={(eb) => onChange((d: any) => { d.errorBoundary = eb; })}
        />
      </div>
    </div>
  );
}
