import { useState } from 'react';
import type { Transition, RoleGrant, ViewBinding, ErrorBoundary } from '@vnext-forge/vnext-types';
import type { ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import type { SchemaReference } from '../../../../../../modules/save-component/components/SchemaReferenceField';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import type { AtomicSavedInfo } from '../../../../../../modules/save-component/componentEditorModalTypes.js';
import { getTriggerKindLabel } from '../PropertyPanelHelpers';
import { Badge, IconTrash, Section } from '../PropertyPanelShared';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { TriggerType } from '@vnext-forge/vnext-types';

import { TransitionExecutionTasksSection } from './TransitionExecutionTasksSection';
import { TransitionSchemaSection } from './TransitionSchemaSection';
import { TransitionMappingSection } from './TransitionMappingSection';
import { TransitionConditionSection } from './TransitionConditionSection';
import { TransitionTimerSection } from './TransitionTimerSection';
import { TransitionRolesSection } from './TransitionRolesSection';
import { TransitionViewSection } from './TransitionViewSection';
import { TransitionLabelsSection } from './TransitionLabelsSection';
import { AvailableInMultiSelect, type StateOption } from '../shared/AvailableInMultiSelect';

export interface TransitionCardProps {
  transition: Transition;
  index: number;
  currentStateKey: string;
  allStateKeys: string[];
  onUpdate: (index: number, field: string, value: unknown) => void;
  onRemove: (index: number) => void;
  onUpdateScript: (
    index: number,
    scriptField: 'rule' | 'condition' | 'timer',
    script: ScriptCode,
  ) => void;
  onRemoveScript: (index: number, scriptField: 'rule' | 'condition' | 'timer') => void;
  onUpdateSchema: (index: number, schema: SchemaReference | null) => void;
  onUpdateMapping: (index: number, mapping: ScriptCode) => void;
  onRemoveMapping: (index: number) => void;
  onUpdateRoles: (index: number, roles: RoleGrant[]) => void;
  onUpdateView: (index: number, view: ViewBinding | null) => void;
  onUpdateViews: (index: number, views: ViewBinding[]) => void;
  onUpdateLabels: (index: number, labels: Array<{ label: string; language: string }>) => void;
  onAddTask: (index: number, task: DiscoveredVnextComponent) => void;
  onRemoveTask: (transitionIndex: number, taskIndex: number) => void;
  onMoveTask: (transitionIndex: number, fromIndex: number, toIndex: number) => void;
  onUpdateTaskMapping: (transitionIndex: number, taskIndex: number, mapping: ScriptCode) => void;
  onRemoveTaskMapping: (transitionIndex: number, taskIndex: number) => void;
  onUpdateTaskErrorBoundary: (transitionIndex: number, taskIndex: number, eb: ErrorBoundary | undefined) => void;
  onSyncTaskRef: (transitionIndex: number, taskIndex: number, next: AtomicSavedInfo) => void;
  onOpenSchemaPicker: (transitionIndex: number) => void;
  onOpenSchemaCreator: (transitionIndex: number) => void;
  onOpenTaskPicker: (transitionIndex: number) => void;
  onOpenTaskCreator: (transitionIndex: number) => void;
  onOpenViewPicker: (transitionIndex: number, bindingIndex: number | null) => void;
  onOpenViewCreator: (transitionIndex: number, bindingIndex: number | null) => void;
  onOpenExtensionPicker: (transitionIndex: number, bindingIndex: number | null) => void;
  canPickExisting: boolean;
  projectDomain: string;
  defaultTaskFolder?: string;
  /** Hide remove button when rendering a single transition (edge panel). */
  standalone?: boolean;
  /** When provided, renders the AvailableIn multi-select inside the card. */
  availableIn?: string[];
  onUpdateAvailableIn?: (keys: string[]) => void;
  /** State options for the availableIn multi-select dropdown. */
  availableInStateOptions?: StateOption[];
}

export function TransitionCard({
  transition,
  index,
  currentStateKey,
  allStateKeys,
  onUpdate,
  onRemove,
  onUpdateScript,
  onRemoveScript,
  onUpdateSchema,
  onUpdateMapping,
  onRemoveMapping,
  onUpdateRoles,
  onUpdateView,
  onUpdateViews,
  onUpdateLabels,
  onAddTask,
  onRemoveTask,
  onMoveTask,
  onUpdateTaskMapping,
  onRemoveTaskMapping,
  onUpdateTaskErrorBoundary,
  onSyncTaskRef,
  onOpenSchemaPicker,
  onOpenSchemaCreator,
  onOpenTaskPicker,
  onOpenTaskCreator,
  onOpenViewPicker,
  onOpenViewCreator,
  onOpenExtensionPicker,
  canPickExisting,
  standalone,
  availableIn,
  onUpdateAvailableIn,
  availableInStateOptions,
}: TransitionCardProps) {
  const [expanded, setExpanded] = useState(!standalone);
  const target = transition.target || '';
  const triggerKindLabel = getTriggerKindLabel(transition.triggerKind ?? 0);
  const triggerType = transition.triggerType ?? TriggerType.Manual;
  const isAuto = triggerType === TriggerType.Automatic;
  const isScheduled = triggerType === TriggerType.Scheduled;

  return (
    <div className="bg-surface border-border hover:border-muted-border-hover overflow-hidden rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* Header: always visible, toggles expand */}
      <div className="flex items-center gap-1.5 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left cursor-pointer min-w-0"
          aria-expanded={expanded}
          aria-label={`Toggle transition ${transition.key}`}>
          <div className="bg-initial/10 flex size-6 shrink-0 items-center justify-center rounded-lg">
            <ArrowRight size={12} className="text-initial" />
          </div>
          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[12px] font-semibold tracking-tight">
            {transition.key || 'unnamed'}
          </span>
          <span className="text-muted-foreground text-[9px] shrink-0">
            {target === '$self' ? '$self' : target}
          </span>
          {triggerKindLabel && (
            <Badge className="bg-muted text-muted-foreground">{triggerKindLabel}</Badge>
          )}
          <ChevronRight
            size={14}
            className={`text-muted-foreground shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
        {!standalone && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 transition-all"
            aria-label={`Remove transition ${transition.key}`}>
            <IconTrash />
          </button>
        )}
      </div>

      {expanded && (
        <>
      <div className="px-3 pb-2.5">
        {/* Editable key */}
        <div className="mb-2">
          <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Key</label>
          <input
            type="text"
            value={transition.key}
            onChange={(e) => onUpdate(index, 'key', e.target.value)}
            placeholder="e.g. approve-to-review"
            className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all"
            aria-label="Transition key"
          />
        </div>

        {/* Identity fields: stacked layout */}
        <div className="space-y-2">
          {/* Target */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
              Target state
            </label>
            <select
              value={target}
              onChange={(e) => onUpdate(index, 'target', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all cursor-pointer"
              aria-label="Target state">
              <option value="$self">$self (current state)</option>
              {!allStateKeys.includes(target) && target && target !== '$self' && (
                <option value={target}>{target}</option>
              )}
              {allStateKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                  {k === currentStateKey ? ' (self)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger type */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
              Trigger type
            </label>
            <select
              value={triggerType}
              onChange={(e) => onUpdate(index, 'triggerType', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all cursor-pointer"
              aria-label="Trigger type">
              <option value={0}>Manual</option>
              <option value={1}>Auto</option>
              <option value={2}>Scheduled</option>
              <option value={3}>Event</option>
            </select>
          </div>

          {/* Trigger kind — only meaningful for Auto */}
          {!isAuto && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
                Trigger kind
              </label>
              <select
                value={transition.triggerKind ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onUpdate(index, 'triggerKind', v === 0 ? undefined : v);
                }}
                className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all cursor-pointer"
                aria-label="Trigger kind">
                <option value={0}>Standard</option>
                <option value={10}>Default / Fallback</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible sections — domain-driven order */}
      <div className="px-3 pb-3 space-y-2">
        {/* 1. On Execution Tasks */}
        <TransitionExecutionTasksSection
          tasks={transition.onExecutionTasks ?? []}
          stateKey={currentStateKey}
          transitionIndex={index}
          onAddTask={(task) => onAddTask(index, task)}
          onRemoveTask={(taskIndex) => onRemoveTask(index, taskIndex)}
          onMoveTask={(from, to) => onMoveTask(index, from, to)}
          onUpdateMapping={(taskIndex, mapping) => onUpdateTaskMapping(index, taskIndex, mapping)}
          onRemoveMapping={(taskIndex) => onRemoveTaskMapping(index, taskIndex)}
          onUpdateErrorBoundary={(taskIndex, eb) => onUpdateTaskErrorBoundary(index, taskIndex, eb)}
          onSyncTaskRef={(taskIndex, next) => onSyncTaskRef(index, taskIndex, next)}
          onOpenPicker={() => onOpenTaskPicker(index)}
          onOpenCreator={() => onOpenTaskCreator(index)}
          canPickExisting={canPickExisting}
        />

        {/* 2. Schema */}
        <TransitionSchemaSection
          schema={transition.schema ?? null}
          onChange={(ref) => onUpdateSchema(index, ref)}
          onBrowse={() => onOpenSchemaPicker(index)}
          onCreateNew={() => onOpenSchemaCreator(index)}
          canPickExisting={canPickExisting}
        />

        {/* 3. Mapping */}
        <TransitionMappingSection
          mapping={(transition.mapping as ScriptCode | undefined) ?? null}
          stateKey={currentStateKey}
          transitionKey={transition.key}
          index={index}
          onChange={(m) => onUpdateMapping(index, m)}
          onRemove={() => onRemoveMapping(index)}
        />

        {/* 4. Condition (Auto only) */}
        {isAuto && (
          <TransitionConditionSection
            rule={(transition.rule as ScriptCode | undefined) ?? null}
            triggerKind={transition.triggerKind}
            stateKey={currentStateKey}
            transitionKey={transition.key}
            index={index}
            onUpdateScript={(script) => onUpdateScript(index, 'rule', script)}
            onRemoveScript={() => onRemoveScript(index, 'rule')}
            onUpdateTriggerKind={(v) => onUpdate(index, 'triggerKind', v)}
          />
        )}

        {/* 5. Timer (Scheduled only) */}
        {isScheduled && (
          <TransitionTimerSection
            timer={(transition.timer as ScriptCode | undefined) ?? null}
            stateKey={currentStateKey}
            transitionKey={transition.key}
            index={index}
            onUpdateScript={(script) => onUpdateScript(index, 'timer', script)}
            onRemoveScript={() => onRemoveScript(index, 'timer')}
          />
        )}

        {/* 6. Roles */}
        <TransitionRolesSection
          roles={transition.roles ?? []}
          onChange={(roles) => onUpdateRoles(index, roles)}
        />

        {/* 7. Views */}
        <TransitionViewSection
          view={transition.view ?? null}
          views={transition.views ?? []}
          onUpdateView={(view) => onUpdateView(index, view)}
          onUpdateViews={(views) => onUpdateViews(index, views)}
          onBrowseView={(bindingIndex) => onOpenViewPicker(index, bindingIndex)}
          onCreateView={(bindingIndex) => onOpenViewCreator(index, bindingIndex)}
          onBrowseExtension={(bindingIndex) => onOpenExtensionPicker(index, bindingIndex)}
          canPickExisting={canPickExisting}
          stateKey={currentStateKey}
          transitionKey={transition.key}
          transitionIndex={index}
        />

        {/* 8. Available In (shared / cancel transitions only) */}
        {availableIn && onUpdateAvailableIn && availableInStateOptions && (
          <Section title="Available in states" count={availableIn.length} defaultOpen={availableIn.length > 0}>
            <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
              Limit this transition to specific states. Leave empty to apply everywhere.
            </p>
            <AvailableInMultiSelect
              value={availableIn}
              onChange={onUpdateAvailableIn}
              stateOptions={availableInStateOptions}
            />
          </Section>
        )}

        {/* 9. Labels */}
        <TransitionLabelsSection
          labels={transition.labels ?? []}
          onChange={(labels) => onUpdateLabels(index, labels)}
        />
      </div>
        </>
      )}
    </div>
  );
}
