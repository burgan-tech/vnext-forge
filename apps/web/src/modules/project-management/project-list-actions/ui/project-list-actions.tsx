import type { ProjectInfo } from '@modules/project-management/project-types';
import { CreateProjectCard } from '@modules/project-management/features/create-project/ui/create-project-card';
import { ImportProjectDialog } from '@modules/project-management/features/import-project/ui/import-project-dialog';
import { Separator } from '@shared/ui/separator';

interface ProjectListActionsProps {
  onProjectReady: (project: ProjectInfo) => Promise<void> | void;
}

export function ProjectListActions({ onProjectReady }: ProjectListActionsProps) {
  return (
    <section>
      <ImportProjectDialog onImported={onProjectReady} />
      <div className="my-4 flex items-center gap-3">
        <Separator decorative className="flex-1" />
        <span className="text-[11px] font-medium text-subtle">or</span>
        <Separator decorative className="flex-1" />
      </div>
      <CreateProjectCard onCreated={onProjectReady} />
    </section>
  );
}
