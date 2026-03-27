import { ResourceReferenceField } from './ResourceReferenceField';
import { Field } from './Field';
import { ErrorBoundaryPanel } from '../error-boundary/ErrorBoundaryPanel';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface TaskExecutionFormProps {
  execution: any;
  onChange: (updater: (draft: any) => void) => void;
}

export function TaskExecutionForm({ execution, onChange }: TaskExecutionFormProps) {
  const [showMapping, setShowMapping] = useState(false);
  const [showErrorBoundary, setShowErrorBoundary] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <Field label="Order">
          <input
            type="number"
            value={execution.order ?? 0}
            onChange={(e) => onChange((d) => { d.order = parseInt(e.target.value) || 0; })}
            className="w-16 px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        </Field>
      </div>

      <ResourceReferenceField
        label="Task Reference"
        value={execution.task || {}}
        onChange={(val) => onChange((d) => { d.task = val; })}
        showFlow
      />

      <button
        onClick={() => setShowMapping(!showMapping)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
      >
        {showMapping ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Mapping
      </button>
      {showMapping && (
        <Field label="Mapping (C# Expression)">
          <textarea
            value={execution.mapping?.body || ''}
            onChange={(e) =>
              onChange((d) => {
                if (!d.mapping) d.mapping = { language: 'csharp' };
                d.mapping.body = e.target.value;
              })
            }
            placeholder="return input;"
            rows={3}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono resize-y"
          />
        </Field>
      )}

      <button
        onClick={() => setShowErrorBoundary(!showErrorBoundary)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
      >
        {showErrorBoundary ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Error Boundary
      </button>
      {showErrorBoundary && (
        <ErrorBoundaryPanel
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
  );
}
