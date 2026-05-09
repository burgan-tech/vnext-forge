import { memo, useMemo, useState } from 'react';

import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

import { cn, type FileSearchResult } from '@vnext-forge-studio/designer-ui';

const MATCH_HIGHLIGHT_CLASS =
  'rounded-sm px-0 font-medium text-foreground bg-amber-400/45 dark:bg-amber-400/35 ring-1 ring-amber-600/50 dark:ring-amber-300/40';

const INITIAL_VISIBLE_MATCHES = 120;
const SHOW_MORE_STEP = 120;

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

interface MatchHighlightProps {
  result: FileSearchResult;
  query: string;
  matchCase: boolean;
  useRegex: boolean;
}

interface TextPart {
  text: string;
  highlight: boolean;
  key: string;
}

function splitQueryFallbackParts(text: string, query: string, matchCase: boolean): TextPart[] {
  if (!query) return [{ text, highlight: false, key: 'all' }];

  try {
    const flags = matchCase ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const parts: TextPart[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let plainSeq = 0;

    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          text: text.slice(lastIndex, match.index),
          highlight: false,
          key: `p-${plainSeq++}-${lastIndex}`,
        });
      }
      parts.push({
        text: match[0],
        highlight: true,
        key: `m-${match.index}-${match[0].length}`,
      });
      lastIndex = regex.lastIndex;
      if (!regex.global) break;
    }

    if (lastIndex < text.length) {
      parts.push({
        text: text.slice(lastIndex),
        highlight: false,
        key: `p-${plainSeq++}-tail`,
      });
    }

    return parts.length > 0 ? parts : [{ text, highlight: false, key: 'empty-split' }];
  } catch {
    return [{ text, highlight: false, key: 'err' }];
  }
}

function QueryFallbackHighlight({ text, query, matchCase }: { text: string; query: string; matchCase: boolean }) {
  const parts = splitQueryFallbackParts(text, query, matchCase);
  return (
    <span>
      {parts.map((part) =>
        part.highlight ? (
          <mark key={part.key} className={MATCH_HIGHLIGHT_CLASS}>
            {part.text}
          </mark>
        ) : (
          <span key={part.key}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function MatchHighlight({ result, query, matchCase, useRegex }: MatchHighlightProps) {
  const { text, column, matchLength } = result;

  if (matchLength > 0 && column >= 1) {
    const start = column - 1;
    const end = Math.min(start + matchLength, text.length);
    if (start < text.length && end > start) {
      return (
        <span>
          {text.slice(0, start)}
          <mark className={MATCH_HIGHLIGHT_CLASS}>{text.slice(start, end)}</mark>
          {text.slice(end)}
        </span>
      );
    }
  }

  if (!useRegex && query.trim()) {
    return <QueryFallbackHighlight text={text} query={query} matchCase={matchCase} />;
  }

  return <span>{text}</span>;
}

function takeMatchesUpTo(groups: FileGroup[], maxMatches: number): { visible: FileGroup[]; shown: number; total: number } {
  const total = groups.reduce((acc, g) => acc + g.matches.length, 0);
  if (total <= maxMatches) {
    return { visible: groups, shown: total, total };
  }

  const visible: FileGroup[] = [];
  let shown = 0;

  for (const g of groups) {
    if (shown >= maxMatches) break;
    const remaining = maxMatches - shown;
    if (g.matches.length <= remaining) {
      visible.push(g);
      shown += g.matches.length;
    } else {
      visible.push({
        ...g,
        matches: g.matches.slice(0, remaining),
      });
      shown += remaining;
      break;
    }
  }

  return { visible, shown, total };
}

interface FileGroupRowProps {
  group: FileGroup;
  query: string;
  matchCase: boolean;
  useRegex: boolean;
  onResultClick: (result: FileSearchResult) => void;
}

function fileGroupRowsAreEqual(a: FileGroupRowProps, b: FileGroupRowProps): boolean {
  if (
    a.query !== b.query ||
    a.matchCase !== b.matchCase ||
    a.useRegex !== b.useRegex ||
    a.group.filePath !== b.group.filePath ||
    a.onResultClick !== b.onResultClick
  ) {
    return false;
  }
  const am = a.group.matches;
  const bm = b.group.matches;
  if (am.length !== bm.length) return false;
  for (let i = 0; i < am.length; i++) {
    if (am[i] !== bm[i]) return false;
  }
  return true;
}

function FileGroupRowInner({ group, query, matchCase, useRegex, onResultClick }: FileGroupRowProps) {
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
        <span className="text-foreground min-w-0 flex-1 truncate text-[12px] font-medium">{group.fileName}</span>
        <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">{group.matches.length}</span>
      </button>

      <div className="text-muted-foreground truncate px-3 pb-1 pl-9 text-[10px]">{group.relPath}</div>

      {!collapsed && (
        <div>
          {group.matches.map((result) => (
            <button
              key={`${result.path}:${result.line}:${result.column}:${result.matchLength}`}
              type="button"
              onClick={() => onResultClick(result)}
              className={cn(
                'hover:bg-muted-surface flex w-full items-baseline gap-2 py-0.5 pl-9 pr-3 text-left transition-colors',
              )}>
              <span className="text-muted-foreground w-8 shrink-0 text-right text-[10px] tabular-nums">
                {result.line}
              </span>
              <span className="text-foreground min-w-0 flex-1 truncate text-[11px] font-mono">
                <MatchHighlight result={result} query={query} matchCase={matchCase} useRegex={useRegex} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const FileGroupRow = memo(FileGroupRowInner, fileGroupRowsAreEqual);

export interface SearchResultListProps {
  results: FileSearchResult[];
  query: string;
  matchCase: boolean;
  useRegex: boolean;
  projectPath: string;
  totalFilesScanned: number;
  /** When true, live updates are buffered upstream; hides server pagination footer. */
  isStreaming?: boolean;
  truncated: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onResultClick: (result: FileSearchResult) => void;
}

export function SearchResultList({
  results,
  query,
  matchCase,
  useRegex,
  projectPath,
  totalFilesScanned,
  isStreaming = false,
  truncated,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onResultClick,
}: SearchResultListProps) {
  const allGroups = useMemo(() => groupByFile(results, projectPath), [results, projectPath]);
  const [visibleCap, setVisibleCap] = useState(INITIAL_VISIBLE_MATCHES);

  const { visible: cappedGroups, shown, total } = useMemo(
    () => takeMatchesUpTo(allGroups, visibleCap),
    [allGroups, visibleCap],
  );

  const totalMatches = results.length;
  const totalFiles = allGroups.length;
  const hiddenLocal = total - shown;

  const summaryParts: string[] = [];
  if (totalMatches > 0) {
    summaryParts.push(`${totalMatches} result${totalMatches !== 1 ? 's' : ''} in ${totalFiles} file${totalFiles !== 1 ? 's' : ''}`);
  }
  if (truncated) {
    summaryParts.push('Result list truncated by server limit');
  }
  if (totalFilesScanned > 0) {
    summaryParts.push(`${totalFilesScanned} file${totalFilesScanned !== 1 ? 's' : ''} scanned`);
  }

  const liveMessage =
    totalMatches === 0
      ? 'No matches in results.'
      : `${summaryParts[0] ?? ''}${truncated ? '. Results may be incomplete.' : ''}${isStreaming ? ' Updating.' : ''}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        aria-live="polite"
        aria-atomic="true"
        className="text-muted-foreground border-border/60 border-b px-3 py-2 text-[10px]">
        <span className="sr-only">{liveMessage}</span>
        <span aria-hidden="true">
          {totalMatches > 0 ? (
            <>
              {totalMatches} result{totalMatches !== 1 ? 's' : ''} in {totalFiles} file{totalFiles !== 1 ? 's' : ''}
            </>
          ) : (
            'No matches'
          )}
          {truncated ? <span className="text-warning-text ml-1">· Truncated</span> : null}
          {totalFilesScanned > 0 ? (
            <span className="block pt-0.5 text-[9px] opacity-90">
              Scanned {totalFilesScanned} file{totalFilesScanned !== 1 ? 's' : ''}
            </span>
          ) : null}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {cappedGroups.map((group) => (
          <FileGroupRow
            key={group.filePath}
            group={group}
            query={query}
            matchCase={matchCase}
            useRegex={useRegex}
            onResultClick={onResultClick}
          />
        ))}
      </div>

      {hiddenLocal > 0 ? (
        <div className="border-border/60 border-t px-3 py-2">
          <button
            type="button"
            className="text-primary hover:text-primary/90 w-full text-center text-[11px] font-medium underline-offset-2 hover:underline"
            onClick={() => setVisibleCap((c) => c + SHOW_MORE_STEP)}>
            Show more ({hiddenLocal} hidden in this panel)
          </button>
        </div>
      ) : null}

      {hasMore && !isStreaming ? (
        <div className="border-border/60 border-t px-3 py-2">
          <button
            type="button"
            disabled={isLoadingMore}
            className="text-primary hover:text-primary/90 w-full text-center text-[11px] font-medium disabled:opacity-50"
            onClick={() => onLoadMore()}>
            {isLoadingMore ? 'Loading…' : 'Load more results from server'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
