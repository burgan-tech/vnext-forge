import { useParams } from 'react-router-dom';

import { ViewEditorView } from '@vnext-forge/designer-ui';

import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { useRegisterComponentEditorTab } from '../../modules/project-workspace/hooks/useRegisterComponentEditorTab';

export function ViewEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { setToolbar } = useCodeEditorToolbar();
  useRegisterComponentEditorTab('view');

  if (!id || !group || !name) return null;
  return <ViewEditorView projectId={id} group={group} name={name} registerToolbar={setToolbar} />;
}
