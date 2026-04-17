import { useParams } from 'react-router-dom';

import { ExtensionEditorView } from '@vnext-forge/designer-ui';

export function ExtensionEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  if (!id || !group || !name) return null;
  return <ExtensionEditorView projectId={id} group={group} name={name} />;
}
