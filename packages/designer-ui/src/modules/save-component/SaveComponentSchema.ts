import { z } from 'zod';

export const taskExecutionFormSchema = z.object({
  order: z.coerce.number().int('Order must be an integer.').min(0, 'Order cannot be negative.'),
});

export type TaskExecutionFormValues = z.infer<typeof taskExecutionFormSchema>;

export function toTaskExecutionFormValues(execution: Record<string, unknown>): TaskExecutionFormValues {
  return {
    order: typeof execution.order === 'number' ? execution.order : 0,
  };
}

export const retryPolicyFormSchema = z.object({
  maxRetries: z.coerce.number().int('Max retries must be an integer.').min(1, 'Minimum is 1.').max(100, 'Maximum is 100.'),
  initialDelay: z.coerce.number().int('Initial delay must be an integer.').min(100, 'Minimum is 100 ms.'),
  backoffType: z.enum(['fixed', 'linear', 'exponential']),
  backoffMultiplier: z.coerce.number().min(1, 'Minimum is 1.'),
  maxDelay: z.coerce.number().int('Max delay must be an integer.').min(1000, 'Minimum is 1000 ms.'),
  useJitter: z.boolean(),
});

export type RetryPolicyFormValues = z.infer<typeof retryPolicyFormSchema>;

export function toRetryPolicyFormValues(policy: Record<string, unknown>): RetryPolicyFormValues {
  return {
    maxRetries: typeof policy.maxRetries === 'number' ? policy.maxRetries : 3,
    initialDelay: typeof policy.initialDelay === 'number' ? policy.initialDelay : 1000,
    backoffType:
      policy.backoffType === 'fixed' || policy.backoffType === 'linear' || policy.backoffType === 'exponential'
        ? policy.backoffType
        : 'exponential',
    backoffMultiplier: typeof policy.backoffMultiplier === 'number' ? policy.backoffMultiplier : 2,
    maxDelay: typeof policy.maxDelay === 'number' ? policy.maxDelay : 30000,
    useJitter: typeof policy.useJitter === 'boolean' ? policy.useJitter : true,
  };
}
