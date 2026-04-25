import { z } from 'zod';

const scriptLocationSchema = z
  .string()
  .trim()
  .min(1, 'Script location is required.')
  .refine((value) => value.endsWith('.csx'), 'Script location must end with .csx.');

export function getScriptLocationError(value: string) {
  const result = scriptLocationSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message ?? 'Script location is invalid.';
}
