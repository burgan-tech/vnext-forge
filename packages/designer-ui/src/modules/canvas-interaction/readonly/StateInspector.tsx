import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { MousePointer2, X } from 'lucide-react';
import type { StateView, TaskRefView } from './view-types';
import { Section, InfoRow, Badge, ResourceRef, CodePreview, LabelList, SummaryCard } from '../components/panels/tabs/PropertyPanelShared';
import {
  getStateTypeLabel,
  getStateTypeColor,
  getSubTypeLabel,
  getSubTypeBadge,
} from '../components/panels/tabs/PropertyPanelHelpers';
import { TransitionFields } from './TransitionFields';

type Tab = 'general' | 'tasks' | 'transitions' | 'subflow' | 'error-boundary';

function pickLabel(labels?: { language: string; label: string }[]): string | undefined {
  if (!labels?.length) return undefined;
  return labels.find((l) => l.language.startsWith('en'))?.label ?? labels[0].label;
}

function TaskRefRow({ task }: { task: TaskRefView }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        {task.order != null && (
          <span className="bg-intermediate/10 text-intermediate flex size-6 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums">
            {task.order}
          </span>
        )}
        <span className="text-foreground font-mono text-[12px] font-semibold">{task.ref.key || '?'}</span>
      </div>
      <ResourceRef resource={task.ref} />
      {task.comment && <InfoRow label="Note" value={task.comment} />}
      {task.mapping && <CodePreview code={task.mapping.code ?? ''} location={task.mapping.location} />}
      {task.hasErrorBoundary && <Badge className="bg-muted text-muted-foreground">Error boundary</Badge>}
    </div>
  );
}

export interface StateInspectorProps {
  state: StateView | null;
  onClose?: () => void;
  /** Slot for execution-overlay content (instance view). */
  children?: ReactNode;
}

export function StateInspector({ state, onClose, children }: StateInspectorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  useEffect(() => { setActiveTab('general'); }, [state?.key]);

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="px-6 text-center">
          <div className="bg-muted text-subtle mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl">
            <MousePointer2 size={24} />
          </div>
          <div className="text-muted-foreground text-[13px] font-semibold">Select a state</div>
          <div className="text-subtle mt-1 text-[11px]">Click on a node in the canvas</div>
        </div>
      </div>
    );
  }

  const entries = state.onEntries ?? [];
  const exits = state.onExits ?? [];
  const transitions = state.transitions ?? [];
  const ebCount = state.errorHandlers?.length ?? 0;
  const label = pickLabel(state.labels);

  const tabs: { key: Tab; label: string; count?: number; show: boolean }[] = [
    { key: 'general', label: 'General', show: true },
    { key: 'tasks', label: 'Tasks', count: entries.length + exits.length, show: true },
    { key: 'transitions', label: 'Transitions', count: transitions.length, show: true },
    { key: 'subflow', label: 'SubFlow', show: state.stateType === 4 },
    { key: 'error-boundary', label: 'Error Boundary', count: ebCount, show: true },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border-subtle bg-surface border-b px-3 py-2">
        <div className="mb-0.5 flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className="text-foreground truncate text-[13px] font-bold tracking-tight">{state.key}</span>
            <Badge className={getStateTypeColor(state.stateType)}>{getStateTypeLabel(state.stateType)}</Badge>
            {state.subType != null && state.subType > 0 && (
              <Badge className={getSubTypeBadge(state.subType)}>{getSubTypeLabel(state.subType)}</Badge>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md p-1 transition-colors"
              aria-label="Close panel">
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
        {label && <div className="text-muted-foreground truncate text-[11px] leading-snug">{label}</div>}
      </div>

      {/* Tabs */}
      <div className="border-border-subtle bg-muted-surface flex border-b px-0.5">
        {tabs.filter((t) => t.show).map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`cursor-pointer border-b-2 px-2.5 py-1.5 text-[11px] font-semibold tracking-tight whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'border-secondary-border text-secondary-icon'
                : 'text-muted-foreground hover:text-primary-icon hover:border-muted-border-hover border-transparent'
            }`}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                activeTab === tab.key ? 'bg-secondary-muted text-secondary-icon' : 'bg-muted text-muted-foreground'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {activeTab === 'general' && (
          <div className="space-y-3">
            <InfoRow label="Key" value={state.key} mono copyable />
            <InfoRow label="State Type" value={getStateTypeLabel(state.stateType)} />
            {state.subType != null && state.subType > 0 && (
              <InfoRow label="Sub Type" value={getSubTypeLabel(state.subType)} />
            )}
            {state.comment && <InfoRow label="Description" value={state.comment} />}
            {state.versionStrategy && <InfoRow label="Version Strategy" value={state.versionStrategy} />}

            {state.queryRoles && state.queryRoles.length > 0 && (
              <Section title="Query Roles" count={state.queryRoles.length} defaultOpen={false}>
                <div className="flex flex-wrap gap-1.5">
                  {state.queryRoles.map((r, i) => (
                    <Badge key={i} className="bg-muted text-muted-foreground">{r.role}{r.grant ? ` (${r.grant})` : ''}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {(state.view || (state.views && state.views.length > 0)) && (
              <Section title="Views" count={state.views?.length ?? (state.view ? 1 : 0)} defaultOpen={false}>
                <div className="space-y-2">
                  {state.view && <ResourceRef resource={state.view.view} />}
                  {state.views?.map((v, i) => <ResourceRef key={i} resource={v.view} />)}
                </div>
              </Section>
            )}

            {state.labels && state.labels.length > 0 && (
              <Section title="Labels" count={state.labels.length} defaultOpen>
                <LabelList labels={state.labels} />
              </Section>
            )}

            <div className="mt-3 border-t border-border-subtle pt-3">
              <div className="text-[9px] font-bold text-muted-foreground mb-2 tracking-widest uppercase">Summary</div>
              <div className="grid grid-cols-3 gap-1.5">
                <SummaryCard label="Entry Tasks" value={entries.length} color="text-intermediate bg-intermediate/10" />
                <SummaryCard label="Exit Tasks" value={exits.length} color="text-subflow bg-subflow/10" />
                <SummaryCard label="Transitions" value={transitions.length} color="text-initial bg-initial/10" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <Section title="OnEntry" count={entries.length} defaultOpen>
              {entries.length === 0
                ? <div className="text-muted-foreground py-4 text-center text-[12px]">No entry tasks defined</div>
                : <div className="space-y-2">{entries.map((t, i) => <TaskRefRow key={i} task={t} />)}</div>}
            </Section>
            <Section title="OnExit" count={exits.length} defaultOpen>
              {exits.length === 0
                ? <div className="text-muted-foreground py-4 text-center text-[12px]">No exit tasks defined</div>
                : <div className="space-y-2">{exits.map((t, i) => <TaskRefRow key={i} task={t} />)}</div>}
            </Section>
          </div>
        )}

        {activeTab === 'transitions' && (
          <div className="space-y-2">
            {transitions.length === 0
              ? <div className="text-muted-foreground py-4 text-center text-[12px]">No transitions defined</div>
              : transitions.map((t, i) => (
                  <Section key={i} title={t.key || 'unnamed'} defaultOpen={false}>
                    <TransitionFields transition={t} />
                  </Section>
                ))}
          </div>
        )}

        {activeTab === 'subflow' && (
          <div className="space-y-3">
            {state.subFlowProcess
              ? <Section title="Process" defaultOpen><ResourceRef resource={state.subFlowProcess} /></Section>
              : <div className="text-muted-foreground py-4 text-center text-[12px]">No subflow process reference</div>}
            {state.subFlowMapping && (
              <Section title="Mapping" defaultOpen={false}>
                <CodePreview code={state.subFlowMapping.code ?? ''} location={state.subFlowMapping.location} />
              </Section>
            )}
          </div>
        )}

        {activeTab === 'error-boundary' && (
          <div className="space-y-2">
            {ebCount === 0
              ? <div className="text-muted-foreground py-4 text-center text-[12px]">No error handlers defined</div>
              : state.errorHandlers!.map((h, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface p-2.5 space-y-1">
                    {h.target && <InfoRow label="Target" value={h.target} mono />}
                    {h.comment && <InfoRow label="Note" value={h.comment} />}
                  </div>
                ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
