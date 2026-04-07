import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ProjectInfo } from '@entities/project/model/types';
import { useDeleteProject } from '@features/delete-project/model/useDeleteProject';
import { ProjectListActions } from '@widgets/project-list-actions/ui/project-list-actions';
import { ProjectListHero } from '@widgets/project-list-hero/ui/project-list-hero';
import {
  ProjectListOverview,
  type ProjectListOverviewApi,
} from '@widgets/project-list-overview/ui/project-list-overview';

export function ProjectListPage() {
  const navigate = useNavigate();
  const projectListOverviewApiRef = useRef<ProjectListOverviewApi | null>(null);

  const handleProjectReady = async (project: ProjectInfo) => {
    await projectListOverviewApiRef.current?.refreshProjects();
    projectListOverviewApiRef.current?.selectProject(project);
    navigate(`/project/${project.id}`);
  };

  const deleteProject = useDeleteProject({
    onDeleted: async () => {
      await projectListOverviewApiRef.current?.refreshProjects();
    },
  });

  const openProject = (project: ProjectInfo) => {
    navigate(`/project/${project.id}`);
  };

  return (
    <div className="flex min-h-full w-full items-start justify-center overflow-y-auto py-8">
      <div className="w-full max-w-lg px-6">
        <ProjectListHero />
        <ProjectListActions onProjectReady={handleProjectReady} />
        <ProjectListOverview
          deleteError={deleteProject.deleteError}
          deletingProjectId={deleteProject.deletingProjectId}
          onApiReady={(api) => {
            projectListOverviewApiRef.current = api;
          }}
          onOpen={openProject}
          onDelete={(project) => {
            void deleteProject.removeProject(project);
          }}
        />
      </div>
    </div>
  );
}
