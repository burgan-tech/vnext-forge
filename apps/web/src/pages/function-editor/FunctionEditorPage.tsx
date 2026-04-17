import { useParams } from 'react-router-dom';

import { FunctionEditorView } from '@vnext-forge/designer-ui';

export function FunctionEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  if (!id || !group || !name) return null;
  return <FunctionEditorView projectId={id} group={group} name={name} />;
}
