import { useParams } from 'react-router-dom';

import { ExtensionEditorView } from '@vnext-forge/designer-ui';

import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { useRegisterComponentEditorTab } from '../../modules/project-workspace/hooks/useRegisterComponentEditorTab';

export function ExtensionEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { setToolbar } = useCodeEditorToolbar();
  useRegisterComponentEditorTab('extension');

  if (!id || !group || !name) return null;
  return (
    <ExtensionEditorView projectId={id} group={group} name={name} registerToolbar={setToolbar} />
  );
}
