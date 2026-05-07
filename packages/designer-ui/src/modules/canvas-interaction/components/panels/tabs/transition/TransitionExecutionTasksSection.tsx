import type { TaskExecution, ErrorBoundary } from '@vnext-forge-studio/vnext-types';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type { ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { CsxEditorField } from '../../../../../../modules/save-component/components/CsxEditorField';
import { OpenVnextComponentInModalButton } from '../../../../../../modules/save-component/components/OpenVnextComponentInModalButton.js';
import type { AtomicSavedInfo } from '../../../../../../modules/save-component/componentEditorModalTypes.js';
import { ChooseFromExistingTasksButton } from '../ChooseExistingTaskDialog';
import { CreateNewTaskButton } from '../CreateNewTaskDialog';
import { Section, IconTask, IconTrash, IconUp, IconDown } from '../PropertyPanelShared';
import { TaskErrorBoundaryCollapsible } from '../shared/TaskErrorBoundaryCollapsible';

interface TransitionExecutionTasksSectionProps {
  tasks: TaskExecution[];
  stateKey: string;
  transitionIndex: number;
  onAddTask: (task: DiscoveredVnextComponent) => void;
  onRemoveTask: (taskIndex: number) => void;
  onMoveTask: (fromIndex: number, toIndex: number) => void;
  onUpdateTaskComment?: (taskIndex: number, comment: string | undefined) => void;
  onUpdateMapping: (taskIndex: number, mapping: ScriptCode) => void;
  onRemoveMapping: (taskIndex: number) => void;
  onUpdateErrorBoundary: (taskIndex: number, eb: ErrorBoundary | undefined) => void;
  onSyncTaskRef: (taskIndex: number, next: AtomicSavedInfo) => void;
  onOpenPicker: () => void;
  onOpenCreator: () => void;
  canPickExisting: boolean;
}

export function TransitionExecutionTasksSection({
  tasks,
  stateKey,
  transitionIndex,
  onRemoveTask,
  onMoveTask,
  onUpdateTaskComment,
  onUpdateMapping,
  onRemoveMapping,
  onUpdateErrorBoundary,
  onSyncTaskRef,
  onOpenPicker,
  onOpenCreator,
  canPickExisting,
}: TransitionExecutionTasksSectionProps) {
  return (
    <Section
      title="On execution tasks"
      count={tasks.length}
      icon={<IconTask />}
      defaultOpen={tasks.length > 0}
    >
      {tasks.length === 0 ? (
        <div className="text-muted-foreground py-4 text-center text-[12px]">
          No tasks run on this transition.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((entry, i) => (
            <ExecutionTaskCard
              key={i}
              entry={entry}
              index={i}
              total={tasks.length}
              stateKey={stateKey}
              transitionIndex={transitionIndex}
              onRemove={() => onRemoveTask(i)}
              onMoveUp={() => onMoveTask(i, i - 1)}
              onMoveDown={() => onMoveTask(i, i + 1)}
              onUpdateComment={onUpdateTaskComment ? (c) => onUpdateTaskComment(i, c) : undefined}
              onUpdateMapping={(m) => onUpdateMapping(i, m)}
              onRemoveMapping={() => onRemoveMapping(i)}
              onUpdateErrorBoundary={(eb) => onUpdateErrorBoundary(i, eb)}
              onAtomicSaved={(next) => onSyncTaskRef(i, next)}
            />
          ))}
        </div>
      )}

      <div
        className="mt-2 flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
        role="group"
        aria-label="Add or attach execution task">
        <ChooseFromExistingTasksButton
          onClick={onOpenPicker}
          disabled={!canPickExisting}
          title={
            canPickExisting
              ? 'Pick a task from workspace JSON files'
              : 'Requires an open project and vnext.config.json with paths'
          }
        />
        <CreateNewTaskButton
          onClick={onOpenCreator}
          disabled={!canPickExisting}
          title={
            canPickExisting
              ? 'Create a new task JSON under Tasks/<folder>/'
              : 'Requires an open project and vnext.config.json with paths'
          }
        />
      </div>
    </Section>
  );
}

function ExecutionTaskCard({
  entry,
  index,
  total,
  stateKey,
  transitionIndex,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdateComment,
  onUpdateMapping,
  onRemoveMapping,
  onUpdateErrorBoundary,
  onAtomicSaved,
}: {
  entry: TaskExecution;
  index: number;
  total: number;
  stateKey: string;
  transitionIndex: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateComment?: (comment: string | undefined) => void;
  onUpdateMapping: (mapping: ScriptCode) => void;
  onRemoveMapping: () => void;
  onUpdateErrorBoundary: (eb: ErrorBoundary | undefined) => void;
  onAtomicSaved: (next: AtomicSavedInfo) => void;
}) {
  const ref = entry.task;
  const mapping = entry.mapping;
  const order = entry.order ?? index + 1;

  return (
    <div className="bg-surface border-border hover:border-muted-border-hover overflow-hidden rounded-lg border shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all">
      <div className="flex items-start gap-2 px-2.5 py-2">
        <div className="mt-0.5 flex shrink-0 flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-subtle hover:text-secondary-icon cursor-pointer p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            title="Move up"
            aria-label={`Move task up, position ${order} of ${total}`}>
            <IconUp />
          </button>
          <span className="bg-intermediate/10 text-intermediate flex size-5 items-center justify-center rounded text-[10px] font-bold tabular-nums">
            {order}
          </span>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="text-subtle hover:text-secondary-icon cursor-pointer p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            title="Move down"
            aria-label={`Move task down, position ${order} of ${total}`}>
            <IconDown />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground font-mono text-[11px] font-semibold tracking-tight">
              {ref.key || '?'}
            </span>
            {ref.domain && <span className="text-muted-foreground text-[10px]">@{ref.domain}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            {ref.version && (
              <span className="text-muted-foreground font-mono text-[9px]">v{ref.version}</span>
            )}
            {ref.flow && (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-[9px]">
                {ref.flow}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {ref.key && ref.flow && (
            <OpenVnextComponentInModalButton
              componentKey={String(ref.key)}
              flow={String(ref.flow)}
              className="shrink-0 rounded-lg p-1"
              title="Open task JSON in editor (modal)"
              iconOnly
              onAtomicSaved={onAtomicSaved}
            />
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all"
            aria-label={`Remove task ${ref.key || 'entry'}`}>
            <IconTrash />
          </button>
        </div>
      </div>

      {onUpdateComment && (
        <div className="px-2.5 pb-2">
          <label className="text-muted-foreground text-[10px] font-semibold mb-0.5 block">Description</label>
          <textarea
            value={(entry as unknown as Record<string, unknown>)._comment as string ?? ''}
            onChange={(e) => onUpdateComment(e.target.value || undefined)}
            placeholder="Task execution description..."
            rows={1}
            aria-label="Task execution description"
            className="w-full px-2.5 py-1.5 text-xs font-mono border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all resize-y placeholder:text-subtle"
          />
        </div>
      )}

      <CsxEditorField
        value={mapping as ScriptCode | null | undefined}
        onChange={onUpdateMapping}
        onRemove={onRemoveMapping}
        templateType="mapping"
        contextName={`${stateKey}-transition-${ref.key || 'task'}`}
        label="Mapping"
        stateKey={stateKey}
        listField="transitions"
        index={transitionIndex}
        scriptField={`onExecutionTasks.${index}.mapping`}
      />

      <TaskErrorBoundaryCollapsible
        errorBoundary={entry.errorBoundary}
        onChange={onUpdateErrorBoundary}
      />
    </div>
  );
}
