import { AlertCircle, Plus } from 'lucide-react';

import { FolderBrowser } from '@entities/workspace/ui/folder-browser';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
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
    <Card noBorder variant="default" hoverable={false} className="w-full rounded-[28px]">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-tertiary-muted text-tertiary-icon border-tertiary-border flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
            <Plus size={18} />
          </div>
          <div>
            <CardTitle className="text-sm">Create Project</CardTitle>
            <CardDescription>Start a new vnext domain from scratch</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
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
          <Alert variant="destructive" className="rounded-xl px-3 py-2 text-xs">
            <AlertCircle size={12} />
            <AlertDescription>{createProject.browseError.toUserMessage().message}</AlertDescription>
          </Alert>
        ) : null}

        {createProject.createError ? (
          <Alert variant="destructive" className="rounded-xl px-3 py-2 text-xs">
            <AlertDescription>{createProject.createError.toUserMessage().message}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          variant="tertiary"
          onClick={() => {
            void createProject.submit();
          }}
          loading={createProject.creating}
          disabled={!createProject.canSubmit}
          className="h-10 w-full rounded-xl shadow-sm">
          Create
        </Button>
      </CardContent>
    </Card>
  );
}
