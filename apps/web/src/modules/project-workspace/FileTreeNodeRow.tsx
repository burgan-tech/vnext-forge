import { useCallback, useMemo, type MouseEventHandler } from 'react';

import { ChevronRight } from 'lucide-react';

import {
  cn,
  ComponentFileIcon,
  ComponentFolderIcon,
  RegularFolderIcon,
  useProjectStore,
  VnextConfigFileIcon,
  type ComponentFolderType,
  type FileTreeNode,
} from '@vnext-forge/designer-ui';

import {
  useComponentFileTypesStore,
  type VnextComponentType,
} from '../../app/store/useComponentFileTypesStore';

type FileTone = {
  label: string;
  toneClassName: string;
};

interface FileTreeNodeRowProps {
  node: FileTreeNode;
  depth: number;
  expanded?: boolean;
  componentFolderType?: ComponentFolderType;
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

function toRelativePath(absolutePath: string, projectPath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/');
  const normalizedProject = projectPath.replace(/\\/g, '/');
  if (normalized.startsWith(normalizedProject)) {
    const rel = normalized.slice(normalizedProject.length);
    return rel.startsWith('/') ? rel.slice(1) : rel;
  }
  return normalized;
}

/**
 * path-scoped selector: Zustand sadece bu path'in değeri değiştiğinde re-render tetikler.
 * Dönen değer primitive (string | undefined) olduğu için Object.is karşılaştırması
 * aynı tip ise true döner ve gereksiz re-render engellenir.
 */
function useComponentFileType(nodePath: string, isJson: boolean): VnextComponentType | undefined {
  const projectPath = useProjectStore((s) => s.activeProject?.path);

  const relativePath = useMemo(() => {
    if (!isJson || !projectPath) return null;
    return toRelativePath(nodePath, projectPath);
  }, [isJson, nodePath, projectPath]);

  const selector = useCallback(
    (s: { fileTypes: Record<string, VnextComponentType> }) => {
      if (!relativePath) return undefined;
      return s.fileTypes[relativePath];
    },
    [relativePath],
  );

  return useComponentFileTypesStore(selector);
}

export function FileTreeNodeRow({
  node,
  depth,
  expanded = false,
  componentFolderType,
  onClick,
  onContextMenu,
}: FileTreeNodeRowProps) {
  const rowPaddingLeft = depth * 14 + 6;
  const isJson = node.type === 'file' && node.name.endsWith('.json');
  const componentFileType = useComponentFileType(node.path, isJson);

  if (node.type === 'file') {
    const isVnextConfig = node.name === 'vnext.config.json';
    const fileTone = getFileTone(node.name);

    return (
      <div
        className="text-muted-foreground hover:bg-primary-hover hover:text-foreground group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-[3px] text-xs transition-colors"
        style={{ paddingLeft: rowPaddingLeft }}
        onClick={onClick}
        onContextMenu={onContextMenu}>
        {componentFileType ? (
          <ComponentFileIcon type={componentFileType} className="size-4 shrink-0" />
        ) : isVnextConfig ? (
          <VnextConfigFileIcon className="size-4 shrink-0" />
        ) : (
          <span
            className={cn(
              'flex w-4 shrink-0 items-center justify-center text-[9px] font-bold',
              fileTone.toneClassName.split(' ').at(-1),
            )}>
            {fileTone.label}
          </span>
        )}
        <span className="group-hover:text-foreground truncate">{node.name}</span>
      </div>
    );
  }

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
      {componentFolderType ? (
        <ComponentFolderIcon type={componentFolderType} expanded={expanded} className="size-3.5 shrink-0" />
      ) : (
        <RegularFolderIcon expanded={expanded} className="size-3.5 shrink-0" />
      )}
      <span className="group-hover:text-foreground min-w-0 flex-1 truncate font-medium">
        {node.name}
      </span>
    </div>
  );
}
