import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useResolvedColorTheme, useSettingsStore } from '@vnext-forge/designer-ui';
import { ColorThemeSwitch } from '@vnext-forge/designer-ui/ui';

import { ProjectListActions } from './components/ProjectListActions';
import { ProjectListHero } from './components/ProjectListHero';
import { ProjectListOverview, type ProjectListOverviewApi } from './components/ProjectListOverview';
import { useDeleteProject } from './hooks/useDeleteProject';
import type { ProjectInfo } from './ProjectTypes';

export function ProjectManagementView() {
  const navigate = useNavigate();
  const setColorTheme = useSettingsStore((s) => s.setColorTheme);
  const resolvedMode = useResolvedColorTheme();

  const projectListOverviewApiRef = useRef<ProjectListOverviewApi | null>(null);
  const [creating, setCreating] = useState(false);

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
    <div className="bg-background relative flex min-h-full w-full items-start justify-center overflow-y-auto py-8">
      <div className="absolute top-4 right-4 z-10 sm:top-8 sm:right-6">
        <ColorThemeSwitch
          checked={resolvedMode === 'light'}
          onCheckedChange={(next) => setColorTheme(next ? 'light' : 'dark')}
          aria-label="Açık veya koyu renk teması"
        />
      </div>
      <div className="w-full max-w-xl px-4 sm:px-6">
        <ProjectListHero />
        <ProjectListActions
          onProjectReady={handleProjectReady}
          disabled={creating}
          onCreatingChange={setCreating}
        />
        <ProjectListOverview
          deleteError={deleteProject.deleteError}
          deletingProjectId={deleteProject.deletingProjectId}
          disabled={creating}
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
