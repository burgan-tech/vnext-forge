import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { VnextWorkflowErrorHandlersPanel } from '../error-boundary/VnextWorkflowErrorHandlersPanel';
import { CsxEditorField, type ScriptCode } from './CsxEditorField';
import { OpenVnextComponentInModalButton } from './OpenVnextComponentInModalButton.js';
import type { AtomicSavedInfo } from '../componentEditorModalTypes.js';

interface TaskExecutionFormProps {
  execution: any;
  index: number;
  total: number;
  onChange: (updater: (draft: any) => void) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Stable identifier for the parent context (e.g. "extension" or state key). */
  stateKey: string;
  /** List field path used by the script panel store. */
  listField: string;
  /** Called right before the modal opens so the parent can snapshot the component store. */
  onBeforeOpenModal?: () => void;
}

export function TaskExecutionForm({
  execution,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  stateKey,
  listField,
  onBeforeOpenModal,
}: TaskExecutionFormProps) {
  const [showErrorBoundary, setShowErrorBoundary] = useState(false);

  const ref = execution.task ?? {};
  const mapping = execution.mapping;
  const order = execution.order ?? index + 1;

  const handleUpdateMapping = (value: ScriptCode) => {
    onChange((d) => {
      d.mapping = value;
    });
  };

  const handleRemoveMapping = () => {
    onChange((d) => {
      delete d.mapping;
    });
  };

  const handleAtomicSaved = (next: AtomicSavedInfo) => {
    onChange((d) => {
      if (!d.task) d.task = {};
      d.task.key = next.key;
      d.task.version = next.version;
      d.task.domain = next.domain;
      d.task.flow = next.flow;
    });
  };

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
            <ArrowUp size={12} />
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
            <ArrowDown size={12} />
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
            <div onClickCapture={onBeforeOpenModal}>
              <OpenVnextComponentInModalButton
                componentKey={String(ref.key)}
                flow={String(ref.flow)}
                className="shrink-0 rounded-lg p-1"
                title="Open task JSON in editor (modal)"
                iconOnly
                onAtomicSaved={handleAtomicSaved}
              />
            </div>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all"
            aria-label={`Remove task ${ref.key || 'entry'}`}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <CsxEditorField
        value={mapping as ScriptCode | null | undefined}
        onChange={handleUpdateMapping}
        onRemove={handleRemoveMapping}
        templateType="mapping"
        contextName={`${stateKey}-task-${ref.key || 'task'}`}
        label="Mapping"
        stateKey={stateKey}
        listField={listField}
        index={index}
        scriptField="mapping"
      />

      <div className="px-2.5 pb-2">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowErrorBoundary(!showErrorBoundary)}
            type="button"
            variant="default"
            size="sm"
            leftIconType="splitaccent"
            leftIconVariant="destructive"
            leftIcon={
              showErrorBoundary ? (
                <ChevronDown className="size-3.5" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5" aria-hidden />
              )
            }
            className="w-fit">
            Workflow failure handlers
          </Button>
          {execution.errorBoundary?.handlers?.length ? (
            <Badge variant="destructive">{execution.errorBoundary.handlers.length} handlers</Badge>
          ) : null}
        </div>
        {showErrorBoundary && (
          <VnextWorkflowErrorHandlersPanel
            errorBoundary={execution.errorBoundary || {}}
            onChange={(updater) =>
              onChange((d) => {
                if (!d.errorBoundary) d.errorBoundary = {};
                updater(d.errorBoundary);
              })
            }
          />
        )}
      </div>
    </div>
  );
}
