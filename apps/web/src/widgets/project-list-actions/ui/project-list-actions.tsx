import type { ProjectInfo } from '@entities/project/model/types';
import { CreateProjectCard } from '@features/create-project/ui/create-project-card';
import { ImportProjectDialog } from '@features/import-project/ui/import-project-dialog';

interface ProjectListActionsProps {
  onProjectReady: (project: ProjectInfo) => Promise<void> | void;
}

export function ProjectListActions({ onProjectReady }: ProjectListActionsProps) {
  return (
    <section>
      <ImportProjectDialog onImported={onProjectReady} />
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium text-subtle">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <CreateProjectCard onCreated={onProjectReady} />
    </section>
  );
}
