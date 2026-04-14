import type { MouseEventHandler } from 'react';

import { ChevronRight, Folder, FolderOpen } from 'lucide-react';

import type { FileTreeNode } from '@modules/project-management/ProjectTypes';
import { cn } from '@shared/lib/utils/Cn';

type FileTone = {
  label: string;
  toneClassName: string;
};

interface FileTreeNodeRowProps {
  node: FileTreeNode;
  depth: number;
  expanded?: boolean;
  isWorkflowContext?: boolean;
  onClick: () => void;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
}

function getFileTone(name: string): FileTone {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return {
        label: '{}',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-json',
      };
    case 'csx':
    case 'cs':
      return {
        label: 'C#',
        toneClassName: 'border-tertiary-border bg-tertiary-surface text-filetype-csharp',
      };
    case 'js':
      return {
        label: 'JS',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-js',
      };
    case 'ts':
      return {
        label: 'TS',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-ts',
      };
    case 'sql':
      return {
        label: 'SQ',
        toneClassName: 'border-primary-border bg-primary-surface text-filetype-sql',
      };
    case 'sh':
    case 'bash':
      return {
        label: 'SH',
        toneClassName: 'border-primary-border bg-primary-surface text-filetype-shell',
      };
    case 'md':
      return {
        label: 'MD',
        toneClassName: 'border-muted-border bg-muted-surface text-muted-icon',
      };
    case 'yaml':
    case 'yml':
      return {
        label: 'YM',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-yaml',
      };
    case 'xml':
      return {
        label: 'XL',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-xml',
      };
    case 'html':
      return {
        label: 'HT',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-html',
      };
    case 'css':
      return {
        label: 'CS',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-css',
      };
    case 'py':
      return {
        label: 'PY',
        toneClassName: 'border-tertiary-border bg-tertiary-surface text-filetype-python',
      };
    case 'http':
      return {
        label: 'HT',
        toneClassName: 'border-primary-border bg-primary-surface text-filetype-shell',
      };
    default:
      return {
        label: '~',
        toneClassName: 'border-muted-border bg-muted-surface text-muted-icon',
      };
  }
}

export function FileTreeNodeRow({
  node,
  depth,
  expanded = false,
  isWorkflowContext = false,
  onClick,
  onContextMenu,
}: FileTreeNodeRowProps) {
  const rowPaddingLeft = depth * 14 + 6;

  if (node.type === 'file') {
    const fileTone = getFileTone(node.name);

    return (
      <div
        className="text-muted-foreground hover:bg-primary-hover hover:text-foreground group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-[3px] text-xs transition-colors"
        style={{ paddingLeft: rowPaddingLeft }}
        onClick={onClick}
        onContextMenu={onContextMenu}>
        <span
          className={cn(
            'flex w-4 shrink-0 items-center justify-center text-[9px] font-bold',
            fileTone.toneClassName.split(' ').at(-1),
          )}>
          {fileTone.label}
        </span>
        <span className="group-hover:text-foreground truncate">{node.name}</span>
      </div>
    );
  }

  /*  Dont use shared/ui/Button or something similar this component unique.
   **  We are trying to keep this component folder structure like file tree in vscode
   */

  return (
    <div
      className="text-muted-foreground hover:bg-primary-hover hover:text-foreground group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-[3px] text-xs transition-colors"
      style={{ paddingLeft: rowPaddingLeft }}
      onClick={onClick}
      onContextMenu={onContextMenu}>
      <span className="text-muted-icon flex w-3 shrink-0 items-center justify-center">
        <ChevronRight
          className={cn('size-3 transition-transform duration-150', expanded && 'rotate-90')}
        />
      </span>
      {expanded ? (
        <FolderOpen className="text-secondary-icon size-3.5 shrink-0" />
      ) : (
        <Folder className="text-muted-icon size-3.5 shrink-0" />
      )}
      <span className="group-hover:text-foreground min-w-0 flex-1 truncate font-medium">
        {node.name}
      </span>
      {isWorkflowContext && (
        <span className="text-tertiary-text text-[9px] font-semibold tracking-[0.14em] uppercase">
          workflow
        </span>
      )}
    </div>
  );
}
