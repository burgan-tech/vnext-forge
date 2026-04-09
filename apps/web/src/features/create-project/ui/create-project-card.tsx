import { AlertCircle, Plus } from 'lucide-react';

import { FolderBrowser } from '@entities/workspace/ui/folder-browser';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';

import { useCreateProject } from '../model/useCreateProject';

type CreateProjectCallback = (
  project: import('@entities/project/model/types').ProjectInfo,
) => Promise<void> | void;

interface CreateProjectCardProps {
  onCreated?: CreateProjectCallback;
}

export function CreateProjectCard({ onCreated }: CreateProjectCardProps) {
  const createProject = useCreateProject({ onCreated });

  return (
    <section className="bg-card w-full rounded-2xl px-6 py-5">
      <div className="mb-4 flex items-center gap-3 rounded-2xl p-3">
        <div className="bg-secondary-muted text-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Plus size={18} />
        </div>
        <div>
          <div className="text-foreground text-sm font-semibold">Create Project</div>
          <div className="text-muted-foreground text-xs">Start a new vnext domain from scratch</div>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          type="text"
          placeholder="my-domain"
          value={createProject.domain}
          onChange={(event) => createProject.setDomain(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void createProject.submit();
            }
          }}
        />

        <FolderBrowser
          currentPath={createProject.browsePath}
          folders={createProject.folders}
          selectedPath={createProject.selectedPath}
          placeholder="Location (default: ~/vnext-projects)"
          open={createProject.pickerOpen}
          onToggle={() => {
            if (createProject.pickerOpen) {
              createProject.setPickerOpen(false);
              return;
            }

            void createProject.openPicker();
          }}
          onNavigate={(path) => {
            void createProject.openPicker(path);
          }}
          onSelect={(path) => {
            createProject.setSelectedPath(path);
            createProject.setPickerOpen(false);
          }}
        />

        {createProject.browseError ? (
          <p className="text-destructive-text flex items-center gap-2 text-xs">
            <AlertCircle size={12} />
            {createProject.browseError.toUserMessage().message}
          </p>
        ) : null}

        {createProject.createError ? (
          <p className="text-destructive-text text-xs">
            {createProject.createError.toUserMessage().message}
          </p>
        ) : null}

        <Button
          onClick={() => {
            void createProject.submit();
          }}
          loading={createProject.creating}
          disabled={!createProject.canSubmit}
          className="bg-secondary text-secondary-foreground shadow-secondary/20 hover:bg-secondary-hover h-10 w-full rounded-xl shadow-sm">
          <p className="text-secondary-text">Create</p>
        </Button>
      </div>
    </section>
  );
}
