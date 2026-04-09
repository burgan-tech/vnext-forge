import type { ProjectInfo } from './ProjectTypes';
import { ProjectListItem } from './ProjectListItem';

interface ProjectListProps {
  projects: ProjectInfo[];
  deletingProjectId?: string | null;
  onOpen: (project: ProjectInfo) => void;
  onDelete: (project: ProjectInfo) => void;
}

export function ProjectList({
  projects,
  deletingProjectId,
  onOpen,
  onDelete,
}: ProjectListProps) {
  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <ProjectListItem
          key={project.id}
          project={project}
          deleting={deletingProjectId === project.id}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
