import { useEffect } from 'react';

import { Link2 } from 'lucide-react';

import type { ProjectInfo } from '@entities/project/model/types';
import { useProjectList } from '@features/project-list/model/useProjectList';
import { ProjectListSection } from '@features/project-list/ui/project-list-section';
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
    <div className={`rounded-xl border border-error-border bg-error-surface px-4 py-3 text-sm text-error-foreground ${className}`}>
      {error.toUserMessage().message}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-8 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.04),transparent_60%)]" />
      <div className="relative">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-subtle">
          <Link2 size={18} />
        </div>
        <p className="text-sm font-semibold text-foreground">No projects yet</p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Create a new domain or import an existing workspace to get started.
        </p>
      </div>
    </section>
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
    <section>
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
