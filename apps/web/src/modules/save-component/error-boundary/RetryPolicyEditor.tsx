import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Field } from '@shared/ui/Field';
import {
  retryPolicyFormSchema,
  type RetryPolicyFormValues,
  toRetryPolicyFormValues,
} from '../SaveComponentSchema';

interface RetryPolicyEditorProps {
  policy: any;
  onChange: (updater: (draft: any) => void) => void;
}

export function RetryPolicyEditor({ policy, onChange }: RetryPolicyEditorProps) {
  const form = useForm<RetryPolicyFormValues>({
    mode: 'onChange',
    defaultValues: toRetryPolicyFormValues(policy),
  });
  const values = useWatch({ control: form.control });
  const currentPolicyValues = toRetryPolicyFormValues(policy);

  useEffect(() => {
    const nextValues = toRetryPolicyFormValues(policy);
    const currentValues = form.getValues();

    if (JSON.stringify(nextValues) !== JSON.stringify(currentValues)) {
      form.reset(nextValues);
    }
  }, [form, policy]);

  useEffect(() => {
    const parsed = retryPolicyFormSchema.safeParse(values);
    if (!parsed.success) {
      return;
    }

    if (JSON.stringify(parsed.data) === JSON.stringify(currentPolicyValues)) {
      return;
    }

    onChange((draft) => {
      draft.maxRetries = parsed.data.maxRetries;
      draft.initialDelay = parsed.data.initialDelay;
      draft.backoffType = parsed.data.backoffType;
      draft.backoffMultiplier = parsed.data.backoffMultiplier;
      draft.maxDelay = parsed.data.maxDelay;
      draft.useJitter = parsed.data.useJitter;
    });
  }, [currentPolicyValues, onChange, values]);

  const maxRetriesValidation = form.register('maxRetries', {
    validate: (value) => {
      const result = retryPolicyFormSchema.shape.maxRetries.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Max retries is invalid.';
    },
  });
  const initialDelayValidation = form.register('initialDelay', {
    validate: (value) => {
      const result = retryPolicyFormSchema.shape.initialDelay.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Initial delay is invalid.';
    },
  });
  const backoffMultiplierValidation = form.register('backoffMultiplier', {
    validate: (value) => {
      const result = retryPolicyFormSchema.shape.backoffMultiplier.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Backoff multiplier is invalid.';
    },
  });
  const maxDelayValidation = form.register('maxDelay', {
    validate: (value) => {
      const result = retryPolicyFormSchema.shape.maxDelay.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Max delay is invalid.';
    },
  });

  return (
    <div className="border border-border rounded p-2 space-y-2 bg-muted/20">
      <div className="text-[10px] font-medium text-muted-foreground">Retry Policy</div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Max Retries" hint={form.formState.errors.maxRetries?.message}>
          <input
            type="number"
            {...maxRetriesValidation}
            min={1}
            max={100}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          />
        </Field>
        <Field label="Initial Delay (ms)" hint={form.formState.errors.initialDelay?.message}>
          <input
            type="number"
            {...initialDelayValidation}
            min={100}
            step={100}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          />
        </Field>
        <Field label="Backoff Type">
          <select
            {...form.register('backoffType')}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          >
            <option value="fixed">Fixed</option>
            <option value="linear">Linear</option>
            <option value="exponential">Exponential</option>
          </select>
        </Field>
        <Field label="Backoff Multiplier" hint={form.formState.errors.backoffMultiplier?.message}>
          <input
            type="number"
            {...backoffMultiplierValidation}
            min={1}
            step={0.5}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          />
        </Field>
        <Field label="Max Delay (ms)" hint={form.formState.errors.maxDelay?.message}>
          <input
            type="number"
            {...maxDelayValidation}
            min={1000}
            step={1000}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          />
        </Field>
        <Field label="Use Jitter">
          <select
            value={form.watch('useJitter') ? 'true' : 'false'}
            onChange={(e) => {
              form.setValue('useJitter', e.target.value === 'true', {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
            }}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

