import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { ProjectListActions } from '@modules/project-management/ProjectListActions';
import { ProjectListHero } from '@modules/project-management/ProjectListHero';
import {
  ProjectListOverview,
  type ProjectListOverviewApi,
} from '@modules/project-management/ProjectListOverview';
import type { ProjectInfo } from '@modules/project-management/ProjectTypes';
import { useDeleteProject } from '@modules/project-management/UseDeleteProject';

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
