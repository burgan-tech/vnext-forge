import { z } from 'zod';

const invalidPathCharacterPattern = /[\\/:*?"<>|]/;
const windowsReservedNamePattern =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export const projectDomainSchema = z
  .string()
  .trim()
  .min(1, 'Project domain is required.')
  .refine((value) => value !== '.' && value !== '..', 'This project domain is not allowed.')
  .refine(
    (value) => !invalidPathCharacterPattern.test(value),
    'Use a project domain without path separators or reserved characters.',
  )
  .refine(
    (value) => !windowsReservedNamePattern.test(value),
    'This project domain is reserved by Windows.',
  );

export function getProjectDomainError(value: string): string | null {
  const result = projectDomainSchema.safeParse(value);
  if (result.success) {
    return null;
  }

  return result.error.issues[0]?.message ?? 'Project domain is invalid.';
}

export function normalizeProjectDomain(value: string): string {
  return projectDomainSchema.parse(value);
}
