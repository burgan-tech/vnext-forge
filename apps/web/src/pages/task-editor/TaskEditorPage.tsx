import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { TaskEditorView, useEditorStore, useProjectStore } from '@vnext-forge/designer-ui';

import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { useRegisterComponentEditorTab } from '../../modules/project-workspace/hooks/useRegisterComponentEditorTab';

export function TaskEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { setToolbar } = useCodeEditorToolbar();
  useRegisterComponentEditorTab('task');
  const navigate = useNavigate();
  const activeProject = useProjectStore((s) => s.activeProject);
  const openTab = useEditorStore((s) => s.openTab);

  const onOpenScriptFileInHost = useCallback(
    (absolutePath: string) => {
      if (!activeProject) return;
      const filePath = absolutePath.replace(/\\/g, '/');
      const title = filePath.split('/').pop() ?? filePath;
      openTab({
        id: filePath,
        kind: 'file',
        title,
        filePath,
        language: 'csharp',
      });
      navigate(`/project/${activeProject.id}/code/${encodeURIComponent(filePath)}`);
    },
    [activeProject, navigate, openTab],
  );

  if (!id || !group || !name) return null;
  return (
    <TaskEditorView
      projectId={id}
      group={group}
      name={name}
      registerToolbar={setToolbar}
      onOpenScriptFileInHost={onOpenScriptFileInHost}
    />
  );
}
