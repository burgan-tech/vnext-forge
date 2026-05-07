import { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { ErrorHandler, ErrorAction, RetryPolicy } from '@vnext-forge-studio/vnext-types';
import { getErrorActionLabel, getErrorActionColor } from '../PropertyPanelHelpers';
import { SelectField, EditableInput, IconTrash, Badge } from '../PropertyPanelShared';
import { RetryPolicyEditor } from './RetryPolicyEditor';

interface ErrorHandlerCardProps {
  handler: ErrorHandler;
  index: number;
  total: number;
  onChange: (handler: ErrorHandler) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const ACTION_OPTIONS = [
  { value: 0, label: 'Abort' },
  { value: 1, label: 'Retry' },
  { value: 2, label: 'Rollback' },
  { value: 3, label: 'Ignore' },
  { value: 4, label: 'Notify' },
  { value: 5, label: 'Log' },
] as const;

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelay: 'PT5S',
  backoffType: 1,
  backoffMultiplier: 2.0,
  maxDelay: 'PT1M',
  useJitter: true,
};

export function ErrorHandlerCard({
  handler,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ErrorHandlerCardProps) {
  const [expanded, setExpanded] = useState(true);

  const update = <K extends keyof ErrorHandler>(field: K, value: ErrorHandler[K]) => {
    onChange({ ...handler, [field]: value });
  };

  const actionLabel = getErrorActionLabel(handler.action);
  const showTransition = handler.action === 0 || handler.action === 4;
  const showRetry = handler.action === 1;

  return (
    <div className="bg-muted-surface border-border rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-1.5 text-left cursor-pointer"
          aria-expanded={expanded}
          aria-label={`Error handler ${index + 1}`}>
          <span className="bg-muted text-muted-foreground inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold">
            {index + 1}
          </span>
          <Badge className={getErrorActionColor(handler.action)}>
            {actionLabel}
          </Badge>
          <span className="text-[10px] text-muted-foreground truncate flex-1">
            {handler.errorTypes?.length ? handler.errorTypes.join(', ') : '*'}
          </span>
          <ChevronRight
            size={12}
            className={`text-muted-foreground shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          {index > 0 && (
            <button type="button" onClick={onMoveUp} className="text-subtle hover:text-foreground p-0.5 cursor-pointer text-[10px]" aria-label="Move up" title="Move up">
              ↑
            </button>
          )}
          {index < total - 1 && (
            <button type="button" onClick={onMoveDown} className="text-subtle hover:text-foreground p-0.5 cursor-pointer text-[10px]" aria-label="Move down" title="Move down">
              ↓
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-subtle hover:text-destructive-text p-0.5 cursor-pointer"
            aria-label={`Remove handler ${index + 1}`}>
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2.5 border-t border-border pt-2">
          {/* Action */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Action</label>
            <SelectField
              value={handler.action}
              onChange={(v) => {
                const action = Number(v) as ErrorAction;
                const next: ErrorHandler = { ...handler, action };
                if (action === 1 && !next.retryPolicy) {
                  next.retryPolicy = { ...DEFAULT_RETRY_POLICY };
                }
                if (action !== 1) {
                  delete next.retryPolicy;
                }
                onChange(next);
              }}
              options={[...ACTION_OPTIONS]}
            />
          </div>

          {/* Error Types */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Error types</label>
            <TagInput
              values={handler.errorTypes ?? []}
              onChange={(v) => update('errorTypes', v.length > 0 ? v : undefined)}
              placeholder='e.g. ValidationException'
            />
          </div>

          {/* Error Codes */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Error codes</label>
            <TagInput
              values={handler.errorCodes ?? []}
              onChange={(v) => update('errorCodes', v.length > 0 ? v : undefined)}
              placeholder='e.g. Task:400007'
            />
          </div>

          {/* Transition */}
          {showTransition && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Transition key</label>
              <EditableInput
                value={handler.transition ?? ''}
                onChange={(v) => update('transition', v || undefined)}
                mono
                placeholder="e.g. error-state"
              />
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Priority</label>
            <input
              type="number"
              min={1}
              max={999}
              value={handler.priority ?? 100}
              onChange={(e) => update('priority', Number(e.target.value) || 100)}
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 tabular-nums"
            />
            <p className="text-[9px] text-muted-foreground mt-0.5">Lower value = higher priority. Fallback: 999</p>
          </div>

          {/* logOnly */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={handler.logOnly ?? false}
              onChange={() => update('logOnly', !(handler.logOnly ?? false) || undefined)}
              className="accent-primary size-3.5 cursor-pointer"
            />
            <span className="text-[10px] text-foreground font-medium">Log only</span>
          </label>

          {/* Retry Policy */}
          {showRetry && handler.retryPolicy && (
            <RetryPolicyEditor
              policy={handler.retryPolicy}
              onChange={(p) => update('retryPolicy', p)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Tag input (chips) ─── */

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
      setInput('');
    }
    if (e.key === 'Backspace' && !input && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {values.map((v) => (
          <span
            key={v}
            className="bg-muted text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-subtle hover:text-destructive-text cursor-pointer"
              aria-label={`Remove ${v}`}>
              <X className="size-2.5" strokeWidth={2.5} />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-[10px] border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-ring/20 font-mono"
      />
    </div>
  );
}
