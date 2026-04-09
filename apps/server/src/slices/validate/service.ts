// Integration point for workflow validation logic.
// Currently returns a stub until the validation engine is wired into this slice.
export const validateService = {
  validate(_workflow: unknown): { valid: boolean; errors: unknown[]; warnings: unknown[] } {
    return { valid: true, errors: [], warnings: [] };
  },
};
