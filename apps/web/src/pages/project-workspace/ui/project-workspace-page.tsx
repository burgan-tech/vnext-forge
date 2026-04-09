import { useNavigate, useParams } from 'react-router-dom';

import { useProjectStore } from '@modules/project-management/project-store';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';

import { useProjectWorkspacePage } from '../model/use-project-workspace-page';

export function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, error, loading } = useProjectStore();

  useProjectWorkspacePage(id);

  if (loading && !activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading project...
      </div>
    );
  }

  if (error && !activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Project could not be loaded.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Button
          className="px-0 text-xs text-muted-foreground hover:text-foreground"
          noBorder
          onClick={() => navigate('/')}
          size="sm"
          variant="ghost"
        >
          Projects
        </Button>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-sm font-medium">{activeProject.domain}</span>
        {activeProject.linked ? <Badge variant="muted">linked</Badge> : null}
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-lg font-semibold">{activeProject.domain}</h2>
          <p className="text-sm text-muted-foreground">
            Select a file from the sidebar to start editing.
          </p>
        </div>
      </div>
    </div>
  );
}
