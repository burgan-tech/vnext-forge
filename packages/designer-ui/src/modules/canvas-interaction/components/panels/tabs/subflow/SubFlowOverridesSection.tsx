import { useState } from 'react';
import type { RoleGrant, SubFlowOverrides, SubFlowTimeoutOverride } from '@vnext-forge/vnext-types';
import { Section, EditableInput, IconPlus, IconTrash } from '../PropertyPanelShared';
import { RoleGrantEditor } from './RoleGrantEditor';

interface SubFlowOverridesSectionProps {
  overrides: SubFlowOverrides | undefined;
  onUpdateOverrides: (updater: (overrides: SubFlowOverrides) => void) => void;
}

export function SubFlowOverridesSection({ overrides, onUpdateOverrides }: SubFlowOverridesSectionProps) {
  const timeoutConfigured = !!overrides?.timeout?.key;
  const transitionCount = Object.keys(overrides?.transitions ?? {}).length;
  const stateCount = Object.keys(overrides?.states ?? {}).length;
  const totalCount = (timeoutConfigured ? 1 : 0) + transitionCount + stateCount;

  return (
    <Section title="Overrides" count={totalCount} defaultOpen={totalCount > 0}>
      <div className="space-y-3">
        <TimeoutOverrideSection
          timeout={overrides?.timeout}
          onUpdate={(updater) => onUpdateOverrides((o) => {
            if (!o.timeout) o.timeout = { key: '', target: '' };
            updater(o.timeout);
          })}
          onClear={() => onUpdateOverrides((o) => { delete o.timeout; })}
        />
        <TransitionRoleOverridesSection
          transitions={overrides?.transitions}
          onUpdate={(updater) => onUpdateOverrides((o) => {
            if (!o.transitions) o.transitions = {};
            updater(o.transitions);
          })}
        />
        <StateQueryRoleOverridesSection
          states={overrides?.states}
          onUpdate={(updater) => onUpdateOverrides((o) => {
            if (!o.states) o.states = {};
            updater(o.states);
          })}
        />
      </div>
    </Section>
  );
}

/* ────────────── Timeout Override ────────────── */

function TimeoutOverrideSection({
  timeout,
  onUpdate,
  onClear,
}: {
  timeout: SubFlowTimeoutOverride | undefined;
  onUpdate: (updater: (t: SubFlowTimeoutOverride) => void) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(!!timeout?.key);
  const configured = !!timeout?.key;

  return (
    <div className="rounded-lg bg-muted-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left group hover:bg-muted transition-colors cursor-pointer"
        aria-expanded={open}>
        <span className="text-[11px] font-semibold text-muted-foreground tracking-tight flex-1">
          Timeout override
        </span>
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold">
          {configured ? 'Configured' : 'Not set'}
        </span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-1.5">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Key</label>
            <EditableInput value={timeout?.key || ''} onChange={(v) => onUpdate((t) => { t.key = v; })} mono placeholder="e.g. push-timeout" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Target</label>
            <EditableInput value={timeout?.target || ''} onChange={(v) => onUpdate((t) => { t.target = v; })} mono placeholder="e.g. cancelled" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Version strategy</label>
            <EditableInput value={timeout?.versionStrategy || ''} onChange={(v) => onUpdate((t) => { t.versionStrategy = v || undefined; })} placeholder="e.g. Minor" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Timer reset</label>
            <EditableInput value={timeout?.timer?.reset || ''} onChange={(v) => onUpdate((t) => { if (!t.timer) t.timer = {}; t.timer.reset = v || undefined; })} placeholder="e.g. OnEntry" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Duration (ISO 8601)</label>
            <EditableInput value={timeout?.timer?.duration || ''} onChange={(v) => onUpdate((t) => { if (!t.timer) t.timer = {}; t.timer.duration = v || undefined; })} mono placeholder="e.g. PT25M" />
          </div>
          {configured && (
            <button
              type="button"
              onClick={onClear}
              className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors mt-1">
              <IconTrash />
              Clear timeout override
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────── Transition Role Overrides ────────────── */

function TransitionRoleOverridesSection({
  transitions,
  onUpdate,
}: {
  transitions: Record<string, { roles?: RoleGrant[] }> | undefined;
  onUpdate: (updater: (t: Record<string, { roles?: RoleGrant[] }>) => void) => void;
}) {
  const keys = Object.keys(transitions ?? {});
  const [open, setOpen] = useState(keys.length > 0);

  const addTransition = () => {
    onUpdate((t) => {
      const newKey = `transition-${Object.keys(t).length + 1}`;
      t[newKey] = { roles: [] };
    });
  };

  const removeTransition = (key: string) => {
    onUpdate((t) => { delete t[key]; });
  };

  const renameTransition = (oldKey: string, newKey: string) => {
    if (!newKey || newKey === oldKey) return;
    onUpdate((t) => {
      const entry = t[oldKey];
      if (!entry) return;
      delete t[oldKey];
      t[newKey] = entry;
    });
  };

  const updateRoles = (key: string, roles: RoleGrant[]) => {
    onUpdate((t) => {
      if (!t[key]) t[key] = {};
      t[key].roles = roles;
    });
  };

  return (
    <div className="rounded-lg bg-muted-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left group hover:bg-muted transition-colors cursor-pointer"
        aria-expanded={open}>
        <span className="text-[11px] font-semibold text-muted-foreground tracking-tight flex-1">
          Transition role overrides
        </span>
        {keys.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold">
            {keys.length}
          </span>
        )}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2">
          {keys.map((key) => (
            <KeyedRoleGroup
              key={key}
              groupKey={key}
              keyLabel="Transition key"
              roles={transitions?.[key]?.roles ?? []}
              onRename={(newKey) => renameTransition(key, newKey)}
              onRemove={() => removeTransition(key)}
              onUpdateRoles={(roles) => updateRoles(key, roles)}
            />
          ))}
          <button
            type="button"
            onClick={addTransition}
            className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
            <IconPlus />
            Add transition
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────── State QueryRole Overrides ────────────── */

function StateQueryRoleOverridesSection({
  states,
  onUpdate,
}: {
  states: Record<string, { queryRoles?: RoleGrant[] }> | undefined;
  onUpdate: (updater: (s: Record<string, { queryRoles?: RoleGrant[] }>) => void) => void;
}) {
  const keys = Object.keys(states ?? {});
  const [open, setOpen] = useState(keys.length > 0);

  const addState = () => {
    onUpdate((s) => {
      const newKey = `state-${Object.keys(s).length + 1}`;
      s[newKey] = { queryRoles: [] };
    });
  };

  const removeState = (key: string) => {
    onUpdate((s) => { delete s[key]; });
  };

  const renameState = (oldKey: string, newKey: string) => {
    if (!newKey || newKey === oldKey) return;
    onUpdate((s) => {
      const entry = s[oldKey];
      if (!entry) return;
      delete s[oldKey];
      s[newKey] = entry;
    });
  };

  const updateRoles = (key: string, roles: RoleGrant[]) => {
    onUpdate((s) => {
      if (!s[key]) s[key] = {};
      s[key].queryRoles = roles;
    });
  };

  return (
    <div className="rounded-lg bg-muted-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left group hover:bg-muted transition-colors cursor-pointer"
        aria-expanded={open}>
        <span className="text-[11px] font-semibold text-muted-foreground tracking-tight flex-1">
          State query role overrides
        </span>
        {keys.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold">
            {keys.length}
          </span>
        )}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2">
          {keys.map((key) => (
            <KeyedRoleGroup
              key={key}
              groupKey={key}
              keyLabel="State key"
              roles={states?.[key]?.queryRoles ?? []}
              onRename={(newKey) => renameState(key, newKey)}
              onRemove={() => removeState(key)}
              onUpdateRoles={(roles) => updateRoles(key, roles)}
            />
          ))}
          <button
            type="button"
            onClick={addState}
            className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
            <IconPlus />
            Add state
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────── Shared: keyed role group (transition or state) ────────────── */

function KeyedRoleGroup({
  groupKey,
  keyLabel,
  roles,
  onRename,
  onRemove,
  onUpdateRoles,
}: {
  groupKey: string;
  keyLabel: string;
  roles: RoleGrant[];
  onRename: (newKey: string) => void;
  onRemove: () => void;
  onUpdateRoles: (roles: RoleGrant[]) => void;
}) {
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(groupKey);

  const commitRename = () => {
    const trimmed = keyDraft.trim();
    if (trimmed && trimmed !== groupKey) {
      onRename(trimmed);
    } else {
      setKeyDraft(groupKey);
    }
    setEditingKey(false);
  };

  return (
    <div className="border border-border-subtle rounded-lg p-2 bg-surface/50">
      <div className="flex items-center gap-1.5 mb-1.5">
        {editingKey ? (
          <input
            type="text"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setKeyDraft(groupKey); setEditingKey(false); } }}
            className="min-w-0 flex-1 px-2 py-1 text-[11px] font-mono border border-primary-border rounded bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            autoFocus
            aria-label={keyLabel}
          />
        ) : (
          <button
            type="button"
            onClick={() => { setKeyDraft(groupKey); setEditingKey(true); }}
            className="min-w-0 flex-1 text-left text-[11px] font-mono font-semibold text-foreground hover:text-secondary-icon cursor-pointer truncate"
            title={`Click to edit ${keyLabel.toLowerCase()}`}>
            {groupKey}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1 transition-all"
          title={`Remove ${keyLabel.toLowerCase()} "${groupKey}"`}
          aria-label={`Remove ${keyLabel.toLowerCase()} ${groupKey}`}>
          <IconTrash />
        </button>
      </div>
      <RoleGrantEditor
        roles={roles}
        onChange={onUpdateRoles}
        contextLabel={groupKey}
      />
    </div>
  );
}
