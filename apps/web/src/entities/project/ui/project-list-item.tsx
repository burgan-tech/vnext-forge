import { ArrowRight, Folder, Trash2 } from 'lucide-react';

import type { ProjectInfo } from '@entities/project/model/types';

interface ProjectListItemProps {
  project: ProjectInfo;
  deleting?: boolean;
  onOpen: (project: ProjectInfo) => void;
  onDelete: (project: ProjectInfo) => void;
}

export function ProjectListItem({
  project,
  deleting = false,
  onOpen,
  onDelete,
}: ProjectListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(project);
        }
      }}
      className="group flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-left shadow-sm shadow-slate-900/[0.03] transition-all duration-200 hover:border-sky-200 hover:shadow-md hover:shadow-sky-500/8 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-500 transition-colors group-hover:border-sky-200 group-hover:bg-sky-100">
        <Folder size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-slate-900">{project.domain}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-slate-400">{project.path}</div>
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete(project);
        }}
        disabled={deleting}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Delete ${project.domain}`}>
        <Trash2 size={14} />
      </button>
      <ArrowRight
        size={14}
        className="shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-sky-400"
      />
    </div>
  );
}
