/** `1.2.0-pkg.1.17.0+core` → `1.2.0`: the artifact part the designer writes. */
export function artifactVersion(version: string | undefined): string | undefined {
  if (!version) return undefined;
  return version.split('+')[0].split('-pkg.')[0] || undefined;
}

export interface DefinitionDrift {
  localVersion: string;
  instanceVersion: string;
}

/** `null` when either side is unknown or both name the same artifact version. */
export function definitionDrift(localVersion?: string, instanceFlowVersion?: string): DefinitionDrift | null {
  const local = artifactVersion(localVersion);
  const instance = artifactVersion(instanceFlowVersion);
  if (!local || !instance || local === instance) return null;
  return { localVersion: local, instanceVersion: instance };
}

/** `<dir>/<name>.json` → `<dir>/.meta/<name>.diagram.json`, as the flow editor stores it. */
export function diagramPathFor(workflowFilePath: string): string {
  const p = workflowFilePath.replace(/\\/g, '/');
  const slash = p.lastIndexOf('/');
  const dir = slash >= 0 ? p.slice(0, slash) : '';
  const name = (slash >= 0 ? p.slice(slash + 1) : p).replace(/\.json$/i, '');
  return `${dir}/.meta/${name}.diagram.json`;
}
