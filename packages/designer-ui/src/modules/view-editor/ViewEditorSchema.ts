import { z } from 'zod';

export const viewEditorMetadataSchema = z.object({
  version: z.string().trim().min(1, 'Version is required.'),
  domain: z.string().trim().min(1, 'Domain is required.'),
  flow: z.string().trim().min(1, 'Flow is required.'),
});

export function getViewEditorFieldError(
  field: keyof z.infer<typeof viewEditorMetadataSchema>,
  value: string,
): string | undefined {
  const result = viewEditorMetadataSchema.shape[field].safeParse(value);

  if (result.success) {
    return undefined;
  }

  return result.error.issues[0]?.message;
}
