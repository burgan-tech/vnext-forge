import { matchPath } from 'react-router-dom';

import {
  componentEditorTabId,
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

  const kinds: ComponentEditorKind[] = ['flow', 'task', 'schema', 'view', 'function', 'extension'];
  for (const kind of kinds) {
    const m = matchPath(`/project/:id/${kind}/:group/:name`, pathname);
    if (m?.params.id === projectId && m.params.group && m.params.name) {
      return componentEditorTabId(projectId, kind, m.params.group, m.params.name);
    }
  }

  return null;
}
