import { useParams } from 'react-router-dom';

import { ViewEditorView } from '@vnext-forge/designer-ui';

export function ViewEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  if (!id || !group || !name) return null;
  return <ViewEditorView projectId={id} group={group} name={name} />;
}
