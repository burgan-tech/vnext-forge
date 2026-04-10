import { useParams } from 'react-router-dom';
import { FlowEditorView } from '@modules/flow-editor/FlowEditorView';

export function FlowEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();

  if (!id || !group || !name) {
    return null;
  }

  return <FlowEditorView projectId={id} group={group} name={name} />;
}
