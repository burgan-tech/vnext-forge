import { useState } from 'react';

import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

import { cn, type FileSearchResult } from '@vnext-forge-studio/designer-ui';

interface FileGroup {
  filePath: string;
  fileName: string;
  relPath: string;
  matches: FileSearchResult[];
}

function groupByFile(results: FileSearchResult[], projectPath: string): FileGroup[] {
  const map = new Map<string, FileSearchResult[]>();

  for (const result of results) {
    const existing = map.get(result.path);
    if (existing) {
      existing.push(result);
    } else {
      map.set(result.path, [result]);
    }
  }

  return Array.from(map.entries()).map(([filePath, matches]) => {
    const normalized = filePath.replace(/\\/g, '/');
    const projectNormalized = projectPath.replace(/\\/g, '/');
    const relPath = normalized.startsWith(projectNormalized)
      ? normalized.slice(projectNormalized.length).replace(/^\//, '')
      : normalized;
    const fileName = relPath.split('/').pop() ?? relPath;

    return { filePath, fileName, relPath, matches };
  });
}

interface MatchTextProps {
  text: string;
  query: string;
  matchCase: boolean;
}

function MatchText({ text, query, matchCase }: MatchTextProps) {
  if (!query) return <span>{text}</span>;

  try {
    const flags = matchCase ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const parts: { text: string; highlight: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
      }
      parts.push({ text: match[0], highlight: true });
      lastIndex = regex.lastIndex;
      if (!regex.global) break;
    }

    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), highlight: false });
    }

    return (
      <span>
        {parts.map((part, i) =>
          part.highlight ? (
            <mark key={i} className="bg-brand-from/30 text-foreground rounded-sm px-0 font-medium">
              {part.text}
            </mark>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </span>
    );
  } catch {
    return <span>{text}</span>;
  }
}

interface FileGroupRowProps {
  group: FileGroup;
  query: string;
  matchCase: boolean;
  onResultClick: (result: FileSearchResult) => void;
}

function FileGroupRow({ group, query, matchCase, onResultClick }: FileGroupRowProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="hover:bg-muted-surface flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors">
        {collapsed ? (
          <ChevronRight className="text-muted-foreground size-3 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-3 shrink-0" />
        )}
        <FileText className="text-muted-foreground size-3 shrink-0" />
        <span className="text-foreground min-w-0 flex-1 truncate text-[12px] font-medium">
          {group.fileName}
        </span>
        <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
          {group.matches.length}
        </span>
      </button>

      <div className="text-muted-foreground truncate px-3 pb-1 text-[10px]">{group.relPath}</div>

      {!collapsed && (
        <div>
          {group.matches.map((result, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onResultClick(result)}
              className={cn(
                'hover:bg-muted-surface flex w-full items-baseline gap-2 px-3 py-0.5 text-left transition-colors',
              )}>
              <span className="text-muted-foreground w-8 shrink-0 text-right text-[10px] tabular-nums">
                {result.line}
              </span>
              <span className="text-foreground min-w-0 flex-1 truncate text-[11px] font-mono">
                <MatchText text={result.text} query={query} matchCase={matchCase} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SearchResultListProps {
  results: FileSearchResult[];
  query: string;
  matchCase: boolean;
  projectPath: string;
  onResultClick: (result: FileSearchResult) => void;
}

export function SearchResultList({
  results,
  query,
  matchCase,
  projectPath,
  onResultClick,
}: SearchResultListProps) {
  const groups = groupByFile(results, projectPath);
  const totalMatches = results.length;
  const totalFiles = groups.length;

  return (
    <div>
      <div className="text-muted-foreground px-3 py-2 text-[10px]">
        {totalMatches} result{totalMatches !== 1 ? 's' : ''} in {totalFiles} file
        {totalFiles !== 1 ? 's' : ''}
        {totalMatches >= 100 && ' (limit reached)'}
      </div>
      <div>
        {groups.map((group) => (
          <FileGroupRow
            key={group.filePath}
            group={group}
            query={query}
            matchCase={matchCase}
            onResultClick={onResultClick}
          />
        ))}
      </div>
    </div>
  );
}
