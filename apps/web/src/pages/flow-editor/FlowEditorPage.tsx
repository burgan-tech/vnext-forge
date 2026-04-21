import { useNavigate, useParams } from 'react-router-dom';

import { FlowEditorView } from '@vnext-forge/designer-ui';

import { useRegisterComponentEditorTab } from '../../modules/project-workspace/hooks/useRegisterComponentEditorTab';

export function FlowEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const navigate = useNavigate();
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
    />
  );
}
