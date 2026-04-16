import { ArrowRight, Folder, Trash2 } from 'lucide-react';

import type { ProjectInfo } from '../ProjectTypes';
import { Button } from '@shared/ui/Button';

interface ProjectListItemProps {
  project: ProjectInfo;
  deleting?: boolean;
  disabled?: boolean;
  onOpen: (project: ProjectInfo) => void;
  onDelete: (project: ProjectInfo) => void;
}

export function ProjectListItem({
  project,
  deleting = false,
  disabled = false,
  onOpen,
  onDelete,
}: ProjectListItemProps) {
  const isInteractive = !disabled && !deleting;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => {
        if (isInteractive) onOpen(project);
      }}
      onKeyDown={(event) => {
        if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen(project);
        }
      }}
      className={`group border-primary-border bg-primary focus-visible:ring-ring/50 flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:outline-none ${
        disabled
          ? 'pointer-events-none opacity-50'
          : 'cursor-pointer hover:border-primary-border-hover hover:bg-primary-hover hover:shadow-md'
      }`}>
      <div className="border-info-border bg-info-surface text-info-icon group-hover:border-info-border-hover group-hover:bg-info-hover flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors">
        <Folder size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-primary-text truncate text-[13.5px] font-semibold">
          {project.domain}
        </div>
        <div className="text-muted-foreground mt-0.5 truncate text-[11.5px]">{project.path}</div>
      </div>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        noBorder
        noIconHover
        onClick={(event) => {
          event.stopPropagation();
          onDelete(project);
        }}
        disabled={disabled || deleting}
        className="h-8 w-8 shrink-0 rounded-lg opacity-0 shadow-none transition-all group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Delete ${project.domain}`}>
        <Trash2 size={14} />
      </Button>
      <ArrowRight
        size={14}
        className="text-info-foreground group-hover:text-info-foreground-hover shrink-0 transition-all duration-200 group-hover:translate-x-0.5"
      />
    </div>
  );
}
