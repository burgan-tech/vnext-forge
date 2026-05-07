import { useParams } from 'react-router-dom';

import { SchemaEditorView } from '@vnext-forge-studio/designer-ui';

import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { useRegisterComponentEditorTab } from '../../modules/project-workspace/hooks/useRegisterComponentEditorTab';

export function SchemaEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { setToolbar } = useCodeEditorToolbar();
  useRegisterComponentEditorTab('schema');

  if (!id || !group || !name) return null;
  return (
    <SchemaEditorView projectId={id} group={group} name={name} registerToolbar={setToolbar} />
  );
}
