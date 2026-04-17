import { useParams } from 'react-router-dom';

import { SchemaEditorView } from '@vnext-forge/designer-ui';

export function SchemaEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  if (!id || !group || !name) return null;
  return <SchemaEditorView projectId={id} group={group} name={name} />;
}
