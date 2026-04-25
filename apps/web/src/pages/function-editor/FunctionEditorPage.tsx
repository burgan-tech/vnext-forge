import { useParams } from 'react-router-dom';

import { FunctionEditorView } from '@vnext-forge/designer-ui';

import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { useRegisterComponentEditorTab } from '../../modules/project-workspace/hooks/useRegisterComponentEditorTab';

export function FunctionEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { setToolbar } = useCodeEditorToolbar();
  useRegisterComponentEditorTab('function');

  if (!id || !group || !name) return null;
  return (
    <FunctionEditorView projectId={id} group={group} name={name} registerToolbar={setToolbar} />
  );
}
