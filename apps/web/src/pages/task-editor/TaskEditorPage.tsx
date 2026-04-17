import { useParams } from 'react-router-dom';

import { TaskEditorView } from '@vnext-forge/designer-ui';

export function TaskEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  if (!id || !group || !name) return null;
  return <TaskEditorView projectId={id} group={group} name={name} />;
}
