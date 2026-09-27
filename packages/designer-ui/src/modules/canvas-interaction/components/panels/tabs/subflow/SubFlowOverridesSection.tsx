import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type {
  ResourceReference,
  SubFlowConfig,
  SubFlowLongPollOverride,
  SubFlowOverrides,
  SubFlowStateOverride,
  SubFlowTransitionOverride,
} from '@vnext-forge-studio/vnext-types';
import { ChooseExistingVnextComponentDialog } from '../ChooseExistingTaskDialog';
import { IconPlus, IconTrash, Section } from '../PropertyPanelShared';
import type {
  ChildStateSummary,
  ChildTransitionSummary,
  ChildWorkflowLoadStatus,
  ChildWorkflowSummary,
} from './childWorkflowSummary';
import { KeyCombobox } from './KeyCombobox';
import { OptionalRoleOverride } from './OptionalRoleOverride';
import { TimeoutOverrideEditor } from './TimeoutOverrideEditor';
import { ViewSwapMapEditor } from './ViewSwapMapEditor';
import {
  applyLegacyViewMigration,
  countOverrides,
  hasLegacyViews,
  nextOverrideKey,
  overrideWarnings,
  parseFallbackSeconds,
  planLegacyViewMigration,
  renameRecordKey,
  setLongPollOverride,
  type LongPollOverridePatch,
} from './subFlowOverrides';

export interface SubFlowOverridesSectionProps {
  subFlow: SubFlowConfig;
  /** Parent state owning the subflow. */
  stateKey: string;
  child: ChildWorkflowSummary | null;
  childStatus: ChildWorkflowLoadStatus;
  projectDomain: string;
  canPickViews: boolean;
  onUpdateSubFlow: (updater: (sf: SubFlowConfig) => void) => void;
}

type OverrideScope = 'states' | 'transitions';
interface ViewTarget {
  scope: OverrideScope;
  entryKey: string;
  viewKey: string;
}
type BrowseView = (scope: OverrideScope, entryKey: string, viewKey: string) => void;

function ensureOverrides(sf: SubFlowConfig): SubFlowOverrides {
  sf.overrides ??= {};
  return sf.overrides;
}

const NOTE = 'text-[10px] text-muted-foreground leading-relaxed';

export function SubFlowOverridesSection({
  subFlow,
  stateKey,
  child,
  childStatus,
  projectDomain,
  canPickViews,
  onUpdateSubFlow,
}: SubFlowOverridesSectionProps) {
  const [viewTarget, setViewTarget] = useState<ViewTarget | null>(null);
  const overrides = subFlow.overrides ?? {};
  const total = countOverrides(subFlow);
  const warnings = overrideWarnings(subFlow, child);
  const legacy = hasLegacyViews(subFlow);
  const plan = useMemo(
    () => (legacy && child ? planLegacyViewMigration(subFlow, child) : null),
    [legacy, child, subFlow],
  );
  const isSubProcess = subFlow.type === 'P';

  const updateStates = (updater: (states: Record<string, SubFlowStateOverride>) => void): void =>
    onUpdateSubFlow((sf) => {
      const o = ensureOverrides(sf);
      o.states ??= {};
      updater(o.states);
    });

  const updateTransitions = (updater: (transitions: Record<string, SubFlowTransitionOverride>) => void): void =>
    onUpdateSubFlow((sf) => {
      const o = ensureOverrides(sf);
      o.transitions ??= {};
      updater(o.transitions);
    });

  const browseView: BrowseView | undefined = canPickViews
    ? (scope, entryKey, viewKey) => setViewTarget({ scope, entryKey, viewKey })
    : undefined;

  const handlePickView = (component: DiscoveredVnextComponent): void => {
    const target = viewTarget;
    setViewTarget(null);
    if (!target) return;
    const replacement: ResourceReference = {
      key: component.key,
      domain: projectDomain,
      version: component.version ?? '1.0.0',
      flow: component.flow || 'sys-views',
    };
    onUpdateSubFlow((sf) => {
      const bucket = ensureOverrides(sf)[target.scope];
      const entry = bucket?.[target.entryKey];
      if (!entry) return;
      entry.views = { ...(entry.views ?? {}), [target.viewKey]: replacement };
    });
  };

  return (
    <Section title="Overrides" count={total} defaultOpen={total > 0}>
      <div className="space-y-3">
        <p className={NOTE}>
          <span className="font-semibold">Type:</span> {isSubProcess ? 'SubProcess (P)' : 'SubFlow (S)'} —
          overrides apply to SubFlow (S) only.
        </p>
        {childStatus === 'loading' && <p className={NOTE}>Loading the child workflow…</p>}
        {childStatus === 'unavailable' && (
          <p className={NOTE}>Child workflow not found in this workspace — keys are free text.</p>
        )}

        {warnings.length > 0 && (
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${index}`}
                className="rounded-md border border-warning-border bg-warning-surface px-2 py-1 text-[10px] text-warning-text leading-relaxed">
                {warning.message}
              </li>
            ))}
          </ul>
        )}

        {legacy &&
          (plan?.unplaced.length === 0 ? (
            <button
              type="button"
              onClick={() => onUpdateSubFlow((sf) => applyLegacyViewMigration(sf, plan))}
              className="text-[11px] font-semibold text-secondary-icon hover:text-secondary-foreground bg-secondary-surface hover:bg-secondary-muted border border-secondary-border rounded-lg px-2.5 py-1 cursor-pointer transition-colors">
              Migrate to scoped views
            </button>
          ) : (
            <p className={NOTE}>
              {plan
                ? `Automatic migration is not possible: no child state or transition selects ${plan.unplaced.join(', ')}.`
                : 'Load the child workflow to migrate the legacy view overrides.'}
            </p>
          ))}

        <TimeoutOverrideEditor
          timeout={overrides.timeout ?? undefined}
          stateKey={stateKey}
          childStateKeys={child?.states.map((s) => s.key) ?? []}
          onUpdate={(updater) =>
            onUpdateSubFlow((sf) => {
              const o = ensureOverrides(sf);
              o.timeout ??= { key: '', target: '' };
              updater(o.timeout);
            })
          }
          onClear={() =>
            onUpdateSubFlow((sf) => {
              if (sf.overrides) delete sf.overrides.timeout;
            })
          }
        />

        <TransitionOverridesGroup
          transitions={overrides.transitions}
          childTransitions={child?.transitions ?? []}
          onUpdate={updateTransitions}
          browseView={browseView}
        />

        <StateOverridesGroup
          states={overrides.states}
          childStates={child?.states ?? []}
          onUpdate={updateStates}
          browseView={browseView}
        />
      </div>

      <ChooseExistingVnextComponentDialog
        open={viewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setViewTarget(null);
        }}
        category="views"
        onSelect={handlePickView}
      />
    </Section>
  );
}

/* ────────────── Transition overrides ────────────── */

function TransitionOverridesGroup({
  transitions,
  childTransitions,
  onUpdate,
  browseView,
}: {
  transitions: Record<string, SubFlowTransitionOverride> | undefined;
  childTransitions: ChildTransitionSummary[];
  onUpdate: (updater: (t: Record<string, SubFlowTransitionOverride>) => void) => void;
  browseView: BrowseView | undefined;
}) {
  const keys = Object.keys(transitions ?? {});
  const options = childTransitions.map((t) => t.key);

  return (
    <GroupShell title="Transition overrides" count={keys.length}>
      {keys.map((key) => {
        const entry: SubFlowTransitionOverride = transitions?.[key] ?? {};
        const viewKeyOptions = childTransitions.find((t) => t.key === key)?.viewKeys ?? [];
        return (
          <EntryCard
            key={key}
            entryKey={key}
            keyLabel="Child transition key"
            options={options}
            onRename={(to) => onUpdate((t) => { renameRecordKey(t, key, to); })}
            onRemove={() => onUpdate((t) => { delete t[key]; })}>
            <OptionalRoleOverride
              label="Roles"
              roles={entry.roles}
              contextLabel={key}
              onChange={(roles) =>
                onUpdate((t) => {
                  const e = t[key];
                  if (!e) return;
                  if (roles === undefined) delete e.roles;
                  else e.roles = roles;
                })
              }
            />
            <ViewSwapMapEditor
              value={entry.views}
              viewKeyOptions={viewKeyOptions}
              onChange={(views) =>
                onUpdate((t) => {
                  const e = t[key];
                  if (!e) return;
                  if (views) e.views = views;
                  else delete e.views;
                })
              }
              onBrowse={browseView ? (viewKey) => browseView('transitions', key, viewKey) : undefined}
            />
          </EntryCard>
        );
      })}
      <AddButton
        label="Add transition override"
        onClick={() => onUpdate((t) => { t[nextOverrideKey(t, options, 'transition')] = {}; })}
      />
    </GroupShell>
  );
}

/* ────────────── State overrides ────────────── */

function StateOverridesGroup({
  states,
  childStates,
  onUpdate,
  browseView,
}: {
  states: Record<string, SubFlowStateOverride> | undefined;
  childStates: ChildStateSummary[];
  onUpdate: (updater: (s: Record<string, SubFlowStateOverride>) => void) => void;
  browseView: BrowseView | undefined;
}) {
  const keys = Object.keys(states ?? {});
  const options = childStates.map((s) => s.key);

  return (
    <GroupShell title="State overrides" count={keys.length}>
      {keys.map((key) => {
        const entry: SubFlowStateOverride = states?.[key] ?? {};
        const childState = childStates.find((s) => s.key === key);
        const longPoll = entry.interaction?.longPoll;
        const showLongPoll = (childState?.longPollAuth ?? null) !== null || longPoll !== undefined;
        return (
          <EntryCard
            key={key}
            entryKey={key}
            keyLabel="Child state key"
            options={options}
            onRename={(to) => onUpdate((s) => { renameRecordKey(s, key, to); })}
            onRemove={() => onUpdate((s) => { delete s[key]; })}>
            <OptionalRoleOverride
              label="Query roles"
              roles={entry.queryRoles}
              contextLabel={key}
              onChange={(roles) =>
                onUpdate((s) => {
                  const e = s[key];
                  if (!e) return;
                  if (roles === undefined) delete e.queryRoles;
                  else e.queryRoles = roles;
                })
              }
            />
            {showLongPoll && (
              <LongPollOverrideFields
                entryKey={key}
                longPoll={longPoll}
                onPatch={(patch) =>
                  onUpdate((s) => {
                    const e = s[key];
                    if (e) setLongPollOverride(e, patch);
                  })
                }
              />
            )}
            <ViewSwapMapEditor
              value={entry.views}
              viewKeyOptions={childState?.viewKeys ?? []}
              onChange={(views) =>
                onUpdate((s) => {
                  const e = s[key];
                  if (!e) return;
                  if (views) e.views = views;
                  else delete e.views;
                })
              }
              onBrowse={browseView ? (viewKey) => browseView('states', key, viewKey) : undefined}
            />
          </EntryCard>
        );
      })}
      <AddButton
        label="Add state override"
        onClick={() => onUpdate((s) => { s[nextOverrideKey(s, options, 'state')] = {}; })}
      />
    </GroupShell>
  );
}

function LongPollOverrideFields({
  entryKey,
  longPoll,
  onPatch,
}: {
  entryKey: string;
  longPoll: SubFlowLongPollOverride | undefined;
  onPatch: (patch: LongPollOverridePatch) => void;
}) {
  const stored = longPoll?.fallbackTimeoutSeconds;
  const [text, setText] = useState(stored === undefined ? '' : String(stored));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(stored === undefined ? '' : String(stored));
    setInvalid(false);
  }, [stored]);

  return (
    <div className="rounded-lg border border-border-subtle p-2 space-y-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground block">Long poll</span>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Fallback window (s)</label>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const parsed = parseFallbackSeconds(next);
            setInvalid(!parsed.ok);
            if (parsed.ok) onPatch({ fallbackTimeoutSeconds: parsed.value });
          }}
          aria-label={`Long-poll fallback window for ${entryKey}`}
          aria-invalid={invalid}
          placeholder="Child value"
          className="w-full px-3 py-2 text-xs font-mono border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle"
        />
        {invalid && (
          <p className="mt-0.5 text-[10px] text-destructive-text">Enter a whole number of seconds (1 or more).</p>
        )}
      </div>
      <OptionalRoleOverride
        label="Long-poll roles"
        roles={longPoll?.roles}
        contextLabel={`${entryKey} long poll`}
        onChange={(roles) => onPatch({ roles })}
      />
    </div>
  );
}

/* ────────────── Shared shells ────────────── */

function GroupShell({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(count > 0);
  return (
    <div className="rounded-lg bg-muted-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left group hover:bg-muted transition-colors cursor-pointer"
        aria-expanded={open}>
        <span className="text-[11px] font-semibold text-muted-foreground tracking-tight flex-1">{title}</span>
        {count > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold">
            {count}
          </span>
        )}
      </button>
      {open && <div className="px-2.5 pb-2.5 pt-1 space-y-2">{children}</div>}
    </div>
  );
}

function EntryCard({
  entryKey,
  keyLabel,
  options,
  onRename,
  onRemove,
  children,
}: {
  entryKey: string;
  keyLabel: string;
  options: string[];
  onRename: (to: string) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-border-subtle rounded-lg p-2 bg-surface/50 space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <KeyCombobox value={entryKey} options={options} onCommit={onRename} ariaLabel={keyLabel} placeholder={keyLabel} />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1 transition-all"
          aria-label={`Remove ${keyLabel.toLowerCase()} ${entryKey}`}
          title={`Remove ${keyLabel.toLowerCase()} ${entryKey}`}>
          <IconTrash />
        </button>
      </div>
      {children}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
      <IconPlus />
      {label}
    </button>
  );
}
