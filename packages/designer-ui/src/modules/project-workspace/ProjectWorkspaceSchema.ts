import { z } from 'zod';

const invalidPathCharacterPattern = /[\\/:*?"<>|]/;
const windowsReservedNamePattern =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function validateWorkspaceEntryName(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return { ok: false as const, message: 'Name is required.' };
  }

  if (trimmedValue === '.' || trimmedValue === '..') {
    return { ok: false as const, message: 'This name is not allowed.' };
  }

  if (invalidPathCharacterPattern.test(trimmedValue)) {
    return {
      ok: false as const,
      message: 'Use a name without path separators or reserved characters.',
    };
  }

  if (windowsReservedNamePattern.test(trimmedValue)) {
    return { ok: false as const, message: 'This file name is reserved by Windows.' };
  }

  return { ok: true as const, value: trimmedValue };
}

const workspaceEntryNameSchema = z.string().superRefine((value, ctx) => {
  const result = validateWorkspaceEntryName(value);

  if (!result.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.message,
    });
  }
});

export const createFileNameSchema = workspaceEntryNameSchema.refine(
  (value) => value.trim().includes('.'),
  'Add a file extension, for example `name.json`.',
);

export const createFolderNameSchema = workspaceEntryNameSchema;

export const createWorkflowNameSchema = workspaceEntryNameSchema.refine(
  (value) => !value.trim().includes('.'),
  'Workflow names should not include a file extension.',
);

export const renameEntryNameSchema = workspaceEntryNameSchema;

export function getWorkspaceNameError(
  value: string,
  mode: 'file' | 'folder' | 'workflow' | 'rename',
): string | null {
  const schema =
    mode === 'file'
      ? createFileNameSchema
      : mode === 'folder'
        ? createFolderNameSchema
        : mode === 'workflow'
          ? createWorkflowNameSchema
          : renameEntryNameSchema;

  const result = schema.safeParse(value);
  if (result.success) {
    return null;
  }

  return result.error.issues[0]?.message ?? 'Invalid name.';
}

export function normalizeWorkspaceName(
  value: string,
  mode: 'file' | 'folder' | 'workflow' | 'rename',
): string {
  const schema =
    mode === 'file'
      ? createFileNameSchema
      : mode === 'folder'
        ? createFolderNameSchema
        : mode === 'workflow'
          ? createWorkflowNameSchema
          : renameEntryNameSchema;

  return schema.parse(value).trim();
}

/**
 * vNext JSON bileşen dosyası için tek bir `.json` eki: sondaki `.json` (büyük/küçük harf)
 * varsa kaldırılıp yeniden eklenir; yoksa eklenir.
 */
export function ensureComponentJsonFileName(raw: string): string | null {
  const t = raw.trim();
  const base = t.replace(/\.json$/i, '').trim();
  if (!base) return null;
  return `${base}.json`;
}

/** `ensureComponentJsonFileName` sonrası `getWorkspaceNameError(..., 'file')`. */
export function getVnextComponentJsonFileNameError(raw: string): string | null {
  const ensured = ensureComponentJsonFileName(raw);
  if (!ensured) {
    return 'Name is required.';
  }
  return getWorkspaceNameError(ensured, 'file');
}
