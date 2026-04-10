import { useNavigate, useParams } from 'react-router-dom';

import { useProjectStore } from '@app/store/useProjectStore';
import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';

import { useProjectWorkspacePage } from './UseProjectWorkspacePage';

export function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, error, loading } = useProjectStore();

  useProjectWorkspacePage(id);

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
      <div className="border-border flex items-center gap-3 border-b p-3">
        <Button
          className="text-muted-foreground hover:text-foreground px-0 text-xs"
          noBorder
          onClick={() => navigate('/')}
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
