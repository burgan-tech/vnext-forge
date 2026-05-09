import type { NavigateFunction } from 'react-router-dom';

import { useEditorStore, type EditorTab } from '@vnext-forge-studio/designer-ui';

export function buildNavigatePathForTab(projectId: string, tab: EditorTab): string | null {
  if (tab.kind === 'file' && tab.filePath) {
    return `/project/${projectId}/code/${encodeURIComponent(tab.filePath)}`;
  }
  if (tab.kind === 'workspace-config') {
    return `/project/${projectId}/workspace-config`;
  }
  if (tab.kind === 'quickrun' && tab.group && tab.name) {
    const g = encodeURIComponent(tab.group);
    const n = encodeURIComponent(tab.name);
    return `/project/${projectId}/quickrun/${g}/${n}`;
  }
  if (tab.kind === 'component' && tab.componentKind && tab.group && tab.name) {
    const g = encodeURIComponent(tab.group);
    const n = encodeURIComponent(tab.name);
    const base = `/project/${projectId}`;
    switch (tab.componentKind) {
      case 'flow':
        return `${base}/flow/${g}/${n}`;
      case 'task':
        return `${base}/task/${g}/${n}`;
      case 'schema':
        return `${base}/schema/${g}/${n}`;
      case 'view':
        return `${base}/view/${g}/${n}`;
      case 'function':
        return `${base}/function/${g}/${n}`;
      case 'extension':
        return `${base}/extension/${g}/${n}`;
      default:
        return null;
    }
  }
  return null;
}

/** `closeTab` sonrası kalan aktif sekmeye veya proje köküne yönlendirir. */
export function navigateAfterTabClosed(projectId: string, navigate: NavigateFunction): void {
  const { tabs, activeTabId } = useEditorStore.getState();
  if (tabs.length === 0) {
    navigate(`/project/${projectId}`, { replace: true });
    return;
  }
  const active = tabs.find((t) => t.id === activeTabId);
  if (active) {
    const path = buildNavigatePathForTab(projectId, active);
    if (path) navigate(path, { replace: true });
  }
}
