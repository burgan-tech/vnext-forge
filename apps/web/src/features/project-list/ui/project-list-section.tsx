import type { ProjectInfo } from '@entities/project/model/types';
import { ProjectList } from '@entities/project/ui/project-list';

interface ProjectListSectionProps {
  projects: ProjectInfo[];
  deletingProjectId?: string | null;
  onOpen: (project: ProjectInfo) => void;
  onDelete: (project: ProjectInfo) => void;
}

export function ProjectListSection({
  projects,
  deletingProjectId,
  onOpen,
  onDelete,
}: ProjectListSectionProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 flex justify-center pt-2 text-[11px] font-semibold tracking-[0.24em] text-slate-400 uppercase">
        Recent Projects
      </h2>
      <ProjectList
        projects={projects}
        deletingProjectId={deletingProjectId}
        onOpen={onOpen}
        onDelete={onDelete}
      />
    </section>
  );
}
