import type { VnextWorkspaceConfig } from '@vnext-forge-studio/designer-ui';

/**
 * Absolute path of a workflow from its route coordinates. `_` is the route
 * placeholder for a workflow directly under the workflows root.
 */
export function workflowFilePathFor(
  projectPath: string | undefined,
  paths: VnextWorkspaceConfig['paths'] | undefined,
  group: string | undefined,
  name: string | undefined,
): string | null {
  if (!projectPath || !paths || !group || !name) return null;
  const base = `${projectPath}/${paths.componentsRoot}/${paths.workflows}`;
  const folder = group === '_' ? '' : group;
  const dir = folder ? `${base}/${folder}` : base;
  return `${dir}/${name}.json`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}
