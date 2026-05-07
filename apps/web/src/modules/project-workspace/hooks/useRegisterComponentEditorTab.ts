import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { componentEditorTabId, useEditorStore, type ComponentEditorKind } from '@vnext-forge-studio/designer-ui';

/**
 * Doğrudan URL ile açılan component editör sayfalarında sekmeyi store'a ekler / etkinleştirir.
 */
export function useRegisterComponentEditorTab(kind: ComponentEditorKind) {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const openTab = useEditorStore((s) => s.openTab);

  useEffect(() => {
    if (!id || !group || !name) return;
    openTab({
      id: componentEditorTabId(id, kind, group, name),
      kind: 'component',
      title: `${name}.json`,
      componentKind: kind,
      group,
      name,
    });
  }, [id, group, name, kind, openTab]);
}
