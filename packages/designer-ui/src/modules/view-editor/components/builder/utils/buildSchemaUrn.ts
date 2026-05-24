/**
 * Compose a canonical pseudo-ui dataSchema URN from a discovered
 * workspace schema component.
 *
 * Vnext schemas live at `<projectPath>/<domain>/Schemas/...`. The
 * discovery payload carries the absolute file path; we strip the
 * project root to recover the relative path, then take the first
 * segment as the domain. The URN form (per `parseDataSchemaRef.ts`)
 * is `urn:amorphie:res:schema:<domain>:<key>`. Version suffix is
 * optional — we include it if the component declares one.
 *
 * Falls back to `urn:amorphie:res:schema::<key>` if we cannot
 * determine the domain (e.g. unexpected directory layout). The
 * user can manually edit the URN afterwards in the picker.
 *
 * Both the dataSchema picker dropdown (ViewSettingsPanel) and the
 * builder-wide schema loader (R16) use this helper, so the URN is
 * consistent across "pick" and "resolve" paths.
 */

import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';

export function buildSchemaUrn(
  component: DiscoveredVnextComponent,
  projectPath: string | undefined,
): string {
  let domain = '';
  if (projectPath && component.path.startsWith(projectPath)) {
    const relative = component.path.slice(projectPath.length).replace(/^[/\\]/, '');
    const firstSegment = relative.split(/[/\\]/, 1)[0];
    if (firstSegment) domain = firstSegment;
  }
  const base = `urn:amorphie:res:schema:${domain}:${component.key}`;
  return component.version ? `${base}:${component.version}` : base;
}
