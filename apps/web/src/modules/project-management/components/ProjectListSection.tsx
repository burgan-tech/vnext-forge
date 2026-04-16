import type { ProjectInfo } from '@modules/project-management/ProjectTypes';
import { Section } from '@shared/ui/Section';

import { ProjectList } from './ProjectList';

interface ProjectListSectionProps {
  projects: ProjectInfo[];
  deletingProjectId?: string | null;
  disabled?: boolean;
  onOpen: (project: ProjectInfo) => void;
  onDelete: (project: ProjectInfo) => void;
}

export function ProjectListSection({
  projects,
  deletingProjectId,
  disabled,
  onOpen,
  onDelete,
}: ProjectListSectionProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <Section
      noBorder
      title="Recent Projects"
      description="Continue from an existing vnext workspace."
      count={projects.length}
      variant="default"
      hoverable={false}
      className="rounded-[28px] p-4 sm:p-5">
      <ProjectList
        projects={projects}
        deletingProjectId={deletingProjectId}
        disabled={disabled}
        onOpen={onOpen}
        onDelete={onDelete}
      />
    </Section>
  );
}
