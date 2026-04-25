import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { DropdownSelectField } from '../../../ui/DropdownSelect';
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
          <Input
            type="number"
            {...maxRetriesValidation}
            min={1}
            max={100}
            size="sm"
            className="w-full"
            aria-invalid={Boolean(form.formState.errors.maxRetries)}
            inputClassName="text-xs"
          />
        </Field>
        <Field label="Initial Delay (ms)" hint={form.formState.errors.initialDelay?.message}>
          <Input
            type="number"
            {...initialDelayValidation}
            min={100}
            step={100}
            size="sm"
            className="w-full"
            aria-invalid={Boolean(form.formState.errors.initialDelay)}
            inputClassName="text-xs"
          />
        </Field>
        <Field label="Backoff Type" hint={form.formState.errors.backoffType?.message}>
          <Controller
            name="backoffType"
            control={form.control}
            render={({ field }) => (
              <DropdownSelectField
                ref={field.ref}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                options={[
                  { value: 'fixed', label: 'Fixed' },
                  { value: 'linear', label: 'Linear' },
                  { value: 'exponential', label: 'Exponential' },
                ]}
                className="h-8 min-h-8 w-full text-xs"
              />
            )}
          />
        </Field>
        <Field label="Backoff Multiplier" hint={form.formState.errors.backoffMultiplier?.message}>
          <Input
            type="number"
            {...backoffMultiplierValidation}
            min={1}
            step={0.5}
            size="sm"
            className="w-full"
            aria-invalid={Boolean(form.formState.errors.backoffMultiplier)}
            inputClassName="text-xs"
          />
        </Field>
        <Field label="Max Delay (ms)" hint={form.formState.errors.maxDelay?.message}>
          <Input
            type="number"
            {...maxDelayValidation}
            min={1000}
            step={1000}
            size="sm"
            className="w-full"
            aria-invalid={Boolean(form.formState.errors.maxDelay)}
            inputClassName="text-xs"
          />
        </Field>
        <Field label="Use Jitter" hint={form.formState.errors.useJitter?.message}>
          <Controller
            name="useJitter"
            control={form.control}
            render={({ field }) => (
              <DropdownSelectField
                ref={field.ref}
                value={field.value ? 'true' : 'false'}
                onValueChange={(v) => field.onChange(v === 'true')}
                onBlur={field.onBlur}
                name={field.name}
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
                className="h-8 min-h-8 w-full text-xs"
              />
            )}
          />
        </Field>
      </div>
    </div>
  );
}

