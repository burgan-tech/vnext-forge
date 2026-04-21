import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Field } from '../../../ui/Field';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Textarea } from '../../../ui/Textarea';
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
      <div className="flex items-start gap-2">
        <Field label="Order" hint={form.formState.errors.order?.message}>
          <Input
            type="number"
            {...orderValidation}
            min={0}
            step={1}
            inputMode="numeric"
            size="sm"
            className="w-[4.75rem] min-w-[4.75rem]"
            aria-invalid={Boolean(form.formState.errors.order)}
            inputClassName="text-xs font-mono px-1.5 tabular-nums"
          />
        </Field>
      </div>

      <ResourceReferenceField
        label="Task Reference"
        value={execution.task || {}}
        onChange={(val) =>
          onChange((d) => {
            d.task = val;
          })
        }
        showFlow
      />

      <Button
        onClick={() => setShowMapping(!showMapping)}
        type="button"
        variant="default"
        size="sm"
        leftIconType="splitaccent"
        leftIconVariant="muted"
        leftIcon={
          showMapping ? (
            <ChevronDown className="size-3.5" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden />
          )
        }
        className="w-fit">
        Mapping
      </Button>
      {showMapping && (
        <Field label="Mapping (C# Expression)">
          <Textarea
            value={execution.mapping?.body || ''}
            onChange={(e) =>
              onChange((d) => {
                if (!d.mapping) d.mapping = { language: 'csharp' };
                d.mapping.body = e.target.value;
              })
            }
            placeholder="return input;"
            rows={10}
            spellCheck={false}
            wrap="soft"
            variant="default"
            className="min-h-[10rem] w-full resize-y overflow-auto font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
          />
        </Field>
      )}

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
  );
}
