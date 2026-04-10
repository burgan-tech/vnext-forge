import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { ProjectListActions } from './components/ProjectListActions';
import { ProjectListHero } from './components/ProjectListHero';
import {
  ProjectListOverview,
  type ProjectListOverviewApi,
} from './components/ProjectListOverview';
import { useDeleteProject } from './hooks/useDeleteProject';
import type { ProjectInfo } from './ProjectTypes';

export function ProjectManagementView() {
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
