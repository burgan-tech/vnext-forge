import { useEffect } from 'react';

import { Link2 } from 'lucide-react';

import type { ProjectInfo } from '@entities/project/model/types';
import { useProjectList } from '@features/project-list/model/useProjectList';
import { ProjectListSection } from '@features/project-list/ui/project-list-section';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert';
import { Card, CardContent } from '@shared/ui/card';
import type { VnextForgeError } from '@vnext-forge/app-contracts';

export interface ProjectListOverviewApi {
  refreshProjects: () => Promise<void>;
  selectProject: (project: ProjectInfo) => void;
}

interface ProjectListOverviewProps {
  deleteError?: VnextForgeError | null;
  deletingProjectId?: string | null;
  onApiReady?: (api: ProjectListOverviewApi) => void;
  onOpen: (project: ProjectInfo) => void;
  onDelete: (project: ProjectInfo) => void;
}

function ErrorBanner({ error, className = '' }: { error: VnextForgeError; className?: string }) {
  return (
    <Alert variant="destructive" className={`rounded-2xl ${className}`}>
      <AlertTitle>Could not load projects</AlertTitle>
      <AlertDescription>{error.toUserMessage().message}</AlertDescription>
    </Alert>
  );
}

function EmptyState() {
  return (
    <Card variant="muted" hoverable={false} className="rounded-2xl border-dashed text-center">
      <CardContent className="px-6 py-8">
        <div>
          <div className="bg-muted-surface text-muted-icon border-muted-border mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm">
            <Link2 size={18} />
          </div>
          <p className="text-muted-text text-sm font-semibold">No projects yet</p>
          <p className="text-muted-foreground mt-1.5 text-[13px]">
            Create a new domain or import an existing workspace to get started.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectListOverview({
  deleteError,
  deletingProjectId,
  onApiReady,
  onOpen,
  onDelete,
}: ProjectListOverviewProps) {
  const { projects, loading, error, refreshProjects, selectProject } = useProjectList();

  useEffect(() => {
    onApiReady?.({ refreshProjects, selectProject });
  }, [onApiReady, refreshProjects, selectProject]);

  const handleOpen = (project: ProjectInfo) => {
    selectProject(project);
    onOpen(project);
  };

  return (
    <section className="mt-2">
      {error ? <ErrorBanner error={error} className="mb-5" /> : null}

      {!loading && projects.length === 0 ? <EmptyState /> : null}

      <ProjectListSection
        projects={projects}
        deletingProjectId={deletingProjectId}
        onOpen={handleOpen}
        onDelete={onDelete}
      />

      {deleteError ? <ErrorBanner error={deleteError} className="mt-4" /> : null}
    </section>
  );
}
