// Integration point for @vnext-forge/workflow-system validation.
// Currently returns a stub; full implementation wires in workflow-system validate().
export const validateService = {
  validate(_workflow: unknown): { valid: boolean; errors: unknown[]; warnings: unknown[] } {
    return { valid: true, errors: [], warnings: [] }
  },
}
