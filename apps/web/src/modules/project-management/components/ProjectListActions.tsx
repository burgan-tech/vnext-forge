import type { ProjectInfo } from '@modules/project-management/ProjectTypes';
import { Separator } from '@shared/ui/Separator';

import { CreateProjectCard } from './CreateProjectCard';
import { ImportProjectDialog } from './ImportProjectDialog';

interface ProjectListActionsProps {
  onProjectReady: (project: ProjectInfo) => Promise<void> | void;
  disabled?: boolean;
  onCreatingChange?: (creating: boolean) => void;
}

export function ProjectListActions({
  onProjectReady,
  disabled,
  onCreatingChange,
}: ProjectListActionsProps) {
  return (
    <section>
      <ImportProjectDialog onImported={onProjectReady} disabled={disabled} />
      <div className="my-4 flex items-center gap-3">
        <Separator decorative className="flex-1" />
        <span className="text-[11px] font-medium text-subtle">or</span>
        <Separator decorative className="flex-1" />
      </div>
      <CreateProjectCard
        onCreated={onProjectReady}
        disabled={disabled}
        onCreatingChange={onCreatingChange}
      />
    </section>
  );
}
