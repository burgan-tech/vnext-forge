import type { ComponentEditorKind, EditorTab } from '@vnext-forge/designer-ui';

export function buildNavigatePathForTab(projectId: string, tab: EditorTab): string | null {
  if (tab.kind === 'file' && tab.filePath) {
    return `/project/${projectId}/code/${encodeURIComponent(tab.filePath)}`;
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

const COMPONENT_KIND_LABEL: Record<ComponentEditorKind, string> = {
  flow: 'FL',
  task: 'TS',
  schema: 'SC',
  view: 'VW',
  function: 'FN',
  extension: 'EX',
};

export function componentKindShortLabel(kind: ComponentEditorKind): string {
  return COMPONENT_KIND_LABEL[kind] ?? '?';
}
