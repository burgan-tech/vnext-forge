import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useDeleteProject } from '@modules/project-management/features/delete-project/model/useDeleteProject';
import { ProjectListActions } from '@modules/project-management/project-list-actions/ui/project-list-actions';
import { ProjectListHero } from '@modules/project-management/project-list-hero/ui/project-list-hero';
import {
  ProjectListOverview,
  type ProjectListOverviewApi,
} from '@modules/project-management/project-list-overview/ui/project-list-overview';
import type { ProjectInfo } from '@modules/project-management/project-types';

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
      <div className="w-full max-w-xl px-4 sm:px-6">
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
