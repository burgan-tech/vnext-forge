import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useProjectStore } from '@vnext-forge/designer-ui';
import { Badge, Button } from '@vnext-forge/designer-ui/ui';

import { useVnextWorkspaceUiStore } from '../../app/store/useVnextWorkspaceUiStore';
import { VnextTemplateSeedDialog } from '../../modules/project-workspace/components/VnextTemplateSeedDialog';
import { useProjectWorkspacePage } from '../../modules/project-workspace/hooks/useProjectWorkspacePage';

export function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, error, loading } = useProjectStore();
  const templateSeedDialogOpen = useVnextWorkspaceUiStore((s) => s.templateSeedDialogOpen);
  const setTemplateSeedDialogOpen = useVnextWorkspaceUiStore((s) => s.setTemplateSeedDialogOpen);
  const declineTemplatePromptForProject = useVnextWorkspaceUiStore(
    (s) => s.declineTemplatePromptForProject,
  );
  const setShowMissingVnextConfigBar = useVnextWorkspaceUiStore(
    (s) => s.setShowMissingVnextConfigBar,
  );

  useProjectWorkspacePage(id);

  useEffect(() => {
    return () => {
      setShowMissingVnextConfigBar(false);
    };
  }, [setShowMissingVnextConfigBar]);

  if (loading && !activeProject) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        Loading project...
      </div>
    );
  }

  if (error && !activeProject) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">{error}</div>
    );
  }

  if (!activeProject) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        Project could not be loaded.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {id ? (
        <VnextTemplateSeedDialog
          open={templateSeedDialogOpen}
          onOpenChange={setTemplateSeedDialogOpen}
          projectId={id}
          onDecline={() => declineTemplatePromptForProject(id)}
        />
      ) : null}

      <div className="border-border flex items-center gap-3 border-b p-3">
        <Button
          className="text-muted-foreground hover:text-foreground px-0 text-xs"
          noBorder
          onClick={() => void navigate('/')}
          size="sm"
          variant="ghost">
          Projects
        </Button>
        <span className="text-muted-foreground text-xs">/</span>
        <span className="text-sm font-medium">{activeProject.domain}</span>
        {activeProject.linked ? <Badge variant="muted">linked</Badge> : null}
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-lg font-semibold">{activeProject.domain}</h2>
          <p className="text-muted-foreground text-sm">
            Select a file from the sidebar to start editing.
          </p>
        </div>
      </div>
    </div>
  );
}
