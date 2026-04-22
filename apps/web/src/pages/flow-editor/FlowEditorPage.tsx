import { useNavigate, useParams } from 'react-router-dom';

import { FlowEditorView } from '@vnext-forge/designer-ui';

import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { useRegisterComponentEditorTab } from '../../modules/project-workspace/hooks/useRegisterComponentEditorTab';

export function FlowEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const navigate = useNavigate();
  const { setToolbar } = useCodeEditorToolbar();
  useRegisterComponentEditorTab('flow');

  if (!id || !group || !name) {
    return null;
  }

  return (
    <FlowEditorView
      projectId={id}
      group={group}
      name={name}
      onNavigateBack={() => navigate(`/project/${id}`)}
      registerToolbar={setToolbar}
    />
  );
}
