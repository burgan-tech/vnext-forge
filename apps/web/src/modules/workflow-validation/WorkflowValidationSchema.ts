import { z } from 'zod';

export const validationIssueSeveritySchema = z.enum(['error', 'warning', 'info']);
export type ValidationSeverity = z.infer<typeof validationIssueSeveritySchema>;

const serverValidationIssueSchema = z.union([
  z.string().min(1),
  z.object({
    message: z.string().optional(),
    rule: z.string().optional(),
    nodeId: z.string().optional(),
    path: z.string().optional(),
  }),
]);

const serverValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(serverValidationIssueSchema),
  warnings: z.array(serverValidationIssueSchema),
});

export type ServerValidationIssue = z.infer<typeof serverValidationIssueSchema>;
export type ServerValidationResult = z.infer<typeof serverValidationResultSchema>;

export function parseServerValidationResult(value: unknown): ServerValidationResult {
  return serverValidationResultSchema.parse(value);
}
