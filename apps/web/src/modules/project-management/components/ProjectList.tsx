import type { ProjectInfo } from '../ProjectTypes';
import { ProjectListItem } from './ProjectListItem';

interface ProjectListProps {
  projects: ProjectInfo[];
  deletingProjectId?: string | null;
  disabled?: boolean;
  onOpen: (project: ProjectInfo) => void;
  onDelete: (project: ProjectInfo) => void;
}

export function ProjectList({
  projects,
  deletingProjectId,
  disabled,
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
          disabled={disabled}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
