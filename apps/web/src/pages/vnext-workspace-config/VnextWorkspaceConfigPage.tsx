import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useEditorStore, useProjectStore, vnextWorkspaceConfigTabId } from '@vnext-forge/designer-ui';

import { useProjectListStore } from '../../app/store/useProjectListStore';
import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { CreateVnextConfigDialog } from '../../modules/project-workspace/components/CreateVnextConfigDialog';
import { navigateAfterTabClosed } from '../../modules/project-workspace/editorTabNavigation';
import { syncVnextWorkspaceFromDisk } from '../../modules/project-workspace/syncVnextWorkspaceFromDisk';
import { getProject } from '../../modules/project-management/ProjectApi';

export function VnextWorkspaceConfigPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveProject } = useProjectStore();
  const refreshFileTree = useProjectListStore((s) => s.refreshFileTree);
  const activeProject = useProjectStore((s) => s.activeProject);
  const { setToolbar } = useCodeEditorToolbar();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      if (useProjectStore.getState().activeProject?.id !== id) {
        const res = await getProject(id);
        if (cancelled || !res.success) return;
        setActiveProject(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, setActiveProject]);

  if (!id) {
    return null;
  }

  return (
    <CreateVnextConfigDialog
      presentation="embedded"
      registerToolbar={setToolbar}
      projectId={id}
      defaultDomain={activeProject?.domain ?? id}
      open
      onOpenChange={(next) => {
        if (!next) {
          useEditorStore.getState().closeTab(vnextWorkspaceConfigTabId(id));
          navigateAfterTabClosed(id, navigate);
        }
      }}
      onCompleted={async (completedProjectId) => {
        const pid = completedProjectId || id;
        await syncVnextWorkspaceFromDisk(pid, { openWizardOnMissing: false });
        await refreshFileTree();
      }}
    />
  );
}
