import {
  componentEditorTabId,
  useEditorStore,
  vnextWorkspaceConfigTabId,
} from '@vnext-forge/designer-ui';

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

/** `vnext.config.json` tam sayfa yapılandırma sekmesini açar (rota `navigate` ile tamamlanmalı). */
export function openVnextWorkspaceConfigTab(projectId: string): void {
  useEditorStore.getState().openTab({
    id: vnextWorkspaceConfigTabId(projectId),
    kind: 'workspace-config',
    title: 'vnext.config.json',
  });
}
