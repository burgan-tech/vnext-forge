import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Field } from '../../../ui/Field';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { VnextWorkflowErrorHandlersPanel } from '../error-boundary/VnextWorkflowErrorHandlersPanel';
import {
  taskExecutionFormSchema,
  type TaskExecutionFormValues,
  toTaskExecutionFormValues,
} from '../SaveComponentSchema';
import { ResourceReferenceField } from './ResourceReferenceField';

interface TaskExecutionFormProps {
  execution: any;
  onChange: (updater: (draft: any) => void) => void;
}

export function TaskExecutionForm({ execution, onChange }: TaskExecutionFormProps) {
  const [showMapping, setShowMapping] = useState(false);
  const [showErrorBoundary, setShowErrorBoundary] = useState(false);
  const form = useForm<TaskExecutionFormValues>({
    mode: 'onChange',
    defaultValues: toTaskExecutionFormValues(execution),
  });
  const order = useWatch({ control: form.control, name: 'order' });

  useEffect(() => {
    const nextValues = toTaskExecutionFormValues(execution);
    const currentValues = form.getValues();

    if (JSON.stringify(nextValues) !== JSON.stringify(currentValues)) {
      form.reset(nextValues);
    }
  }, [execution, form]);

  useEffect(() => {
    const parsed = taskExecutionFormSchema.shape.order.safeParse(order);
    if (!parsed.success) {
      return;
    }

    if (execution.order === parsed.data) {
      return;
    }

    onChange((draft) => {
      draft.order = parsed.data;
    });
  }, [execution.order, onChange, order]);

  const orderValidation = form.register('order', {
    validate: (value) => {
      const result = taskExecutionFormSchema.shape.order.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Order is invalid.';
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <Field label="Order" hint={form.formState.errors.order?.message}>
          <input
            type="number"
            {...orderValidation}
            className="w-16 rounded-md border border-primary-border bg-background px-2 py-1 text-xs font-mono text-foreground shadow-sm outline-none transition-colors focus:border-primary-border-hover"
          />
        </Field>
      </div>

      <ResourceReferenceField
        label="Task Reference"
        value={execution.task || {}}
        onChange={(val) => onChange((d) => { d.task = val; })}
        showFlow
      />

      <Button
        onClick={() => setShowMapping(!showMapping)}
        type="button"
        variant="default"
        size="sm"
        leftIconComponent={
          <span className="bg-muted-surface text-muted-text group-hover/button:bg-muted-hover flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200">
            {showMapping ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        }
        className="w-fit"
      >
        Mapping
      </Button>
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
            className="w-full resize-y rounded-md border border-tertiary-border bg-background px-2 py-1 text-xs font-mono text-foreground shadow-sm outline-none transition-colors focus:border-tertiary-border-hover"
          />
        </Field>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={() => setShowErrorBoundary(!showErrorBoundary)}
          type="button"
          variant="default"
          size="sm"
          leftIconComponent={
            <span className="bg-destructive-surface text-destructive-icon group-hover/button:bg-destructive-hover flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200">
              {showErrorBoundary ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          }
          className="w-fit"
        >
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
  );
}
