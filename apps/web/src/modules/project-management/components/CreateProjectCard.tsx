import type { ChangeEvent, KeyboardEvent } from 'react';

import { AlertCircle, Plus } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@vnext-forge/designer-ui/ui';

import { FolderBrowser } from './FolderBrowser';
import { useCreateProject } from '../hooks/useCreateProject';
import type { ProjectInfo } from '../ProjectTypes';

type CreateProjectCallback = (project: ProjectInfo) => Promise<void> | void;

interface CreateProjectCardProps {
  onCreated?: CreateProjectCallback;
  disabled?: boolean;
  onCreatingChange?: (creating: boolean) => void;
}

export function CreateProjectCard({ onCreated, disabled, onCreatingChange }: CreateProjectCardProps) {
  const createProject = useCreateProject({ onCreated, onCreatingChange });
  const handleDomainChange = (event: ChangeEvent<HTMLInputElement>) => {
    createProject.setDomain(event.target.value);
  };

  const handleDomainKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      void createProject.submit();
    }
  };

  return (
    <Card noBorder variant="default" hoverable={false} className="w-full rounded-[28px]">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-success-surface text-success-icon border-success-border flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
            <Plus className="size-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-sm text-success-text">Create Project</CardTitle>
            <CardDescription>Start a new vnext domain from scratch</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <Input
          type="text"
          placeholder="my-domain"
          value={createProject.domain}
          onChange={handleDomainChange}
          aria-invalid={Boolean(createProject.domainError)}
          onKeyDown={handleDomainKeyDown}
          disabled={disabled || createProject.creating}
        />

        {createProject.domainError ? (
          <Alert variant="destructive" className="rounded-xl px-3 py-2 text-xs">
            <AlertDescription>{createProject.domainError}</AlertDescription>
          </Alert>
        ) : null}

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
          variant="success"
          onClick={() => {
            void createProject.submit();
          }}
          loading={createProject.creating}
          disabled={disabled || !createProject.canSubmit}
          className="h-10 w-full rounded-xl shadow-sm">
          {createProject.creating ? 'Creating…' : 'Create'}
        </Button>
      </CardContent>
    </Card>
  );
}
