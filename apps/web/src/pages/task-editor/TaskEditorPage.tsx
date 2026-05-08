import { useParams } from 'react-router-dom';

import { TaskEditorView } from '@vnext-forge-studio/designer-ui';

import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { useRegisterComponentEditorTab } from '../../modules/project-workspace/hooks/useRegisterComponentEditorTab';

export function TaskEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { setToolbar } = useCodeEditorToolbar();
  useRegisterComponentEditorTab('task');

  if (!id || !group || !name) return null;
  return (
    <TaskEditorView
      projectId={id}
      group={group}
      name={name}
      registerToolbar={setToolbar}
    />
  );
}
