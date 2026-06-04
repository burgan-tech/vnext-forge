import { useMemo } from 'react';
import { ListChecks, SquareFunction } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';
import type { ScriptCode } from '../../save-component/components/CsxEditorField';
import { FunctionSingleTaskSection } from './FunctionSingleTaskSection';
import { FunctionMultipleTasksSection } from './FunctionMultipleTasksSection';

type TaskMode = 'single' | 'multiple' | null;

interface FunctionTaskModeSectionProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  onBeforeOpenModal?: () => void;
}

function deriveMode(json: Record<string, unknown>): TaskMode {
  const attrs = json.attributes as Record<string, unknown> | undefined;
  if (!attrs) return null;
  if (Array.isArray(attrs.onExecutionTasks)) return 'multiple';
  if (attrs.task != null && typeof attrs.task === 'object') {
    const taskObj = attrs.task as Record<string, unknown>;
    if (taskObj.task != null || taskObj.order != null) return 'single';
  }
  return null;
}

export function FunctionTaskModeSection({
  json,
  onChange,
  onBeforeOpenModal,
}: FunctionTaskModeSectionProps) {
  const mode = useMemo(() => deriveMode(json), [json]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const functionKey = typeof json.key === 'string' ? json.key : 'function';
  // `attributes.rawResponse` is a boolean toggle (default false). When
  // true the runtime returns the task's raw response body instead of
  // wrapping it in the standard envelope — useful when the function is
  // a thin proxy to a downstream service whose payload should pass
  // through unchanged.
  const rawResponseEnabled = attrs.rawResponse === true;

  function setRawResponse(next: boolean): void {
    onChange((draft) => {
      const a = (draft.attributes ?? {}) as Record<string, unknown>;
      if (next) {
        a.rawResponse = true;
      } else {
        // Drop the field entirely when it matches the schema default
        // so we don't bloat the JSON with `"rawResponse": false`.
        delete a.rawResponse;
      }
      draft.attributes = a;
    });
  }

  function switchToSingle() {
    onChange((draft) => {
      const a = (draft.attributes ?? {}) as Record<string, unknown>;

      if (Array.isArray(a.onExecutionTasks) && (a.onExecutionTasks as any[]).length > 0) {
        const first = (a.onExecutionTasks as any[])[0];
        a.task = { ...first };
      }

      delete a.onExecutionTasks;
      delete a.output;
      draft.attributes = a;
    });
  }

  function switchToMultiple() {
    onChange((draft) => {
      const a = (draft.attributes ?? {}) as Record<string, unknown>;

      if (a.task != null && typeof a.task === 'object') {
        const existing = a.task as Record<string, unknown>;
        a.onExecutionTasks = [{ ...existing, order: 1 }];
      } else {
        a.onExecutionTasks = [];
      }

      delete a.task;
      draft.attributes = a;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={mode === 'single' ? 'secondary' : 'default'}
          size="sm"
          leftIcon={<SquareFunction className="size-3.5" aria-hidden />}
          onClick={switchToSingle}
          className="w-fit">
          Single Task
        </Button>
        <Button
          type="button"
          variant={mode === 'multiple' ? 'secondary' : 'default'}
          size="sm"
          leftIcon={<ListChecks className="size-3.5" aria-hidden />}
          onClick={switchToMultiple}
          className="w-fit">
          Multiple Tasks
        </Button>
      </div>

      <label
        htmlFor="function-attr-rawResponse"
        className="flex w-fit items-start gap-2 rounded border border-border bg-secondary/40 px-2 py-1.5 hover:bg-secondary/60"
        title="When enabled, the runtime returns the task's raw response body to the caller instead of wrapping it in the standard envelope.">
        <Checkbox
          id="function-attr-rawResponse"
          checked={rawResponseEnabled}
          onCheckedChange={(value) => setRawResponse(value === true)}
          className="mt-0.5"
        />
        <div className="flex flex-col">
          <span className="text-xs font-medium">Raw response</span>
          <span className="text-[10px] text-muted-foreground">
            Pass the underlying task response through unchanged (default: off).
          </span>
        </div>
      </label>

      {mode === 'single' && (
        <FunctionSingleTaskSection
          task={attrs.task as any}
          onChange={onChange}
          functionKey={functionKey}
          onBeforeOpenModal={onBeforeOpenModal}
        />
      )}

      {mode === 'multiple' && (
        <FunctionMultipleTasksSection
          tasks={Array.isArray(attrs.onExecutionTasks) ? (attrs.onExecutionTasks as any[]) : []}
          output={(attrs.output as ScriptCode | null | undefined) ?? null}
          onChange={onChange}
          functionKey={functionKey}
          onBeforeOpenModal={onBeforeOpenModal}
        />
      )}

      {mode === null && (
        <p className="text-muted-foreground text-xs">
          Choose a task execution mode to get started.
        </p>
      )}
    </div>
  );
}
