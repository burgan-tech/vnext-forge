import type { ProjectInfo } from '@modules/project-management/project-types';
import { ProjectList } from '@modules/project-management/project-list';
import { Section } from '@shared/ui/section';

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
        onOpen={onOpen}
        onDelete={onDelete}
      />
    </Section>
  );
}
