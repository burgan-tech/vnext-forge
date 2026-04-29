import { readFile } from '../../../project-workspace/WorkspaceApi';

/**
 * Reads a workflow JSON file and returns all unique transition keys
 * (from states[].transitions + sharedTransitions).
 */
export async function loadWorkflowTransitions(workflowPath: string): Promise<string[]> {
  const data = await readFile(workflowPath);
  const json = JSON.parse(data.content) as Record<string, unknown>;
  const attrs = json.attributes as Record<string, unknown> | undefined;
  if (!attrs) return [];

  const keys = new Set<string>();

  const states = attrs.states as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(states)) {
    for (const state of states) {
      const transitions = state.transitions as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(transitions)) {
        for (const t of transitions) {
          if (typeof t.key === 'string' && t.key) keys.add(t.key);
        }
      }
    }
  }

  const shared = attrs.sharedTransitions as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(shared)) {
    for (const t of shared) {
      if (typeof t.key === 'string' && t.key) keys.add(t.key);
    }
  }

  return Array.from(keys).sort();
}
