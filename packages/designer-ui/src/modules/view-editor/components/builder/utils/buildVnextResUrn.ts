/**
 * Compose a canonical vNext resource URN from a discovered workspace
 * component. Symmetric with `parseVnextResUrn` so the picker emit
 * path and the runtime resolve path agree on shape:
 *
 *   urn:vnext:res:<res-key>:<domain>:<key>[:<version>]
 *
 * The discovery payload carries an absolute file path. We strip the
 * project root to recover the relative path and read the first
 * segment as the domain (vnext components live at
 * `<projectPath>/<domain>/<Category>/...`). When the domain cannot
 * be derived (unexpected directory layout, missing project path) we
 * fall back to an empty segment — the user can edit the URN
 * afterwards in the picker.
 */

import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';

import type { ResKey } from '../../../../quick-run/pseudo-ui/parseVnextResUrn';

export interface BuildVnextResUrnArgs {
  resKey: ResKey;
  domain: string;
  key: string;
  version?: string;
}

export function buildVnextResUrn(args: BuildVnextResUrnArgs): string {
  const { resKey, domain, key, version } = args;
  const base = `urn:vnext:res:${resKey}:${domain}:${key}`;
  return version ? `${base}:${version}` : base;
}

/**
 * Convenience for the common picker emit path: derive the domain
 * from the discovered component's absolute path (first path segment
 * relative to the project root), then compose the URN.
 */
export function buildVnextResUrnFromComponent(
  resKey: ResKey,
  component: DiscoveredVnextComponent,
  projectPath: string | undefined,
): string {
  let domain = '';
  if (projectPath && component.path.startsWith(projectPath)) {
    const relative = component.path.slice(projectPath.length).replace(/^[/\\]/, '');
    const firstSegment = relative.split(/[/\\]/, 1)[0];
    if (firstSegment) domain = firstSegment;
  }
  return buildVnextResUrn({
    resKey,
    domain,
    key: component.key,
    version: component.version,
  });
}
