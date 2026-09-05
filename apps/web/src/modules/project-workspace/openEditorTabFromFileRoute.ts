import {
  componentEditorTabId,
  useEditorStore,
  vnextWorkspaceConfigTabId,
} from '@vnext-forge-studio/designer-ui';

import { solutionDisplayLabel } from '@vnext-forge-studio/vnext-types';

import type { FileRoute } from './FileRouter';
import { fileRouteTypeToComponentKind } from './fileRouteTypeToComponentKind';

/** `navigateTo` üretilen FileRoute için sekme kaydı (navigate öncesi çağırın). */
export function openEditorTabForComponentRoute(route: FileRoute, projectId: string): void {
  const kind = fileRouteTypeToComponentKind(route.type);
  if (!kind) return;
  useEditorStore.getState().openTab({
    id: componentEditorTabId(projectId, kind, route.group, route.name),
    kind: 'component',
    title: `${route.name}.json`,
    componentKind: kind,
    group: route.group,
    name: route.name,
  });
}

/**
 * Solution-file full-page configuration tab (route completed by `navigate`).
 * `configFileName` names a domain-suffixed solution (`vnext.<domain>.config.json`);
 * absent = default `vnext.config.json`.
 */
export function openVnextWorkspaceConfigTab(projectId: string, configFileName?: string): void {
  useEditorStore.getState().openTab({
    id: vnextWorkspaceConfigTabId(projectId),
    kind: 'workspace-config',
    title: solutionDisplayLabel(configFileName ?? 'vnext.config.json'),
  });
}
