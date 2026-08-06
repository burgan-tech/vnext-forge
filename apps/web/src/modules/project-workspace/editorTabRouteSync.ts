import { matchPath } from 'react-router-dom';

import {
  componentEditorTabId,
  functionRunInstanceTabId,
  functionRunTabId,
  quickRunTabId,
  vnextWorkspaceConfigTabId,
  type ComponentEditorKind,
} from '@vnext-forge-studio/designer-ui';

/**
 * Mevcut URL'den `useEditorStore` activeTabId değerini türetir (dosya yolu veya component tab id).
 * Proje kökü (`/project/:id`) için `null` döner.
 */
export function activeTabIdFromPathname(projectId: string, pathname: string): string | null {
  const codeMatch = matchPath({ path: '/project/:id/code/*', end: false }, pathname);
  if (codeMatch?.params.id === projectId && codeMatch.params['*']) {
    const raw = String(codeMatch.params['*']).replace(/^\//, '');
    if (raw) return decodeURIComponent(raw);
  }

  const workspaceConfigMatch = matchPath(
    { path: '/project/:id/workspace-config', end: true },
    pathname,
  );
  if (workspaceConfigMatch?.params.id === projectId) {
    return vnextWorkspaceConfigTabId(projectId);
  }

  const quickRunMatch = matchPath({ path: '/project/:id/quickrun/:group/:name', end: true }, pathname);
  if (
    quickRunMatch?.params.id === projectId &&
    quickRunMatch.params.group &&
    quickRunMatch.params.name
  ) {
    return quickRunTabId(projectId, quickRunMatch.params.group, quickRunMatch.params.name);
  }

  const functionRunMatch = matchPath(
    { path: '/project/:id/function-run/:group/:name', end: true },
    pathname,
  );
  if (
    functionRunMatch?.params.id === projectId &&
    functionRunMatch.params.group &&
    functionRunMatch.params.name
  ) {
    return functionRunTabId(projectId, functionRunMatch.params.group, functionRunMatch.params.name);
  }

  // The instance binding lives in the query, deliberately outside the tab
  // id: opening the same function against another instance reuses this tab
  // rather than accumulating one per instance.
  const functionRunInstanceMatch = matchPath(
    { path: '/project/:id/function-run-instance/:domain/:functionKey', end: true },
    pathname,
  );
  if (
    functionRunInstanceMatch?.params.id === projectId &&
    functionRunInstanceMatch.params.domain &&
    functionRunInstanceMatch.params.functionKey
  ) {
    return functionRunInstanceTabId(
      projectId,
      functionRunInstanceMatch.params.domain,
      functionRunInstanceMatch.params.functionKey,
    );
  }

  const kinds: ComponentEditorKind[] = ['flow', 'task', 'schema', 'view', 'function', 'extension'];
  for (const kind of kinds) {
    const m = matchPath(`/project/:id/${kind}/:group/:name`, pathname);
    if (m?.params.id === projectId && m.params.group && m.params.name) {
      return componentEditorTabId(projectId, kind, m.params.group, m.params.name);
    }
  }

  return null;
}
