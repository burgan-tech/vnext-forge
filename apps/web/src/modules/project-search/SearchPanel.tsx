import { useCallback, useId, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Loader2,
  Regex,
  Search as SearchIcon,
  WholeWord,
  X,
} from 'lucide-react';

import {
  Button,
  cn,
  useEditorStore,
  useProjectStore,
  type FileSearchResult,
} from '@vnext-forge-studio/designer-ui';

import {
  openEditorTabForComponentRoute,
  openVnextWorkspaceConfigTab,
} from '../project-workspace/openEditorTabFromFileRoute';
import { resolveFileRoute } from '../project-workspace/FileRouter';

import { SearchResultList } from './SearchResultList';
import { useProjectSearch } from './useProjectSearch';

function ToggleButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex size-6 items-center justify-center rounded transition-colors',
        active
          ? 'bg-brand-from/20 text-brand-from ring-brand-from/30 ring-1'
          : 'text-muted-foreground hover:bg-muted-surface hover:text-foreground',
      )}>
      {children}
    </button>
  );
}

function hitNavigateQuery(result: FileSearchResult): string {
  const params = new URLSearchParams();
  params.set('line', String(result.line));
  params.set('column', String(result.column));
  if (result.matchLength > 0) {
    params.set('matchLen', String(result.matchLength));
  }
  return params.toString();
}

function SearchSkeleton() {
  const rows: { id: string; widthPct: number }[] = [
    { id: 'sk-1', widthPct: 72 },
    { id: 'sk-2', widthPct: 80 },
    { id: 'sk-3', widthPct: 88 },
    { id: 'sk-4', widthPct: 72 },
    { id: 'sk-5', widthPct: 80 },
    { id: 'sk-6', widthPct: 88 },
  ];
  return (
    <div className="flex flex-col gap-2 px-3 py-2" aria-busy="true" aria-label="Searching">
      {rows.map((row) => (
        <div
          key={row.id}
          className="bg-muted/60 h-6 animate-pulse rounded-md"
          style={{ width: `${row.widthPct}%` }}
        />
      ))}
    </div>
  );
}

export function SearchPanel() {
  const activeProject = useProjectStore((s) => s.activeProject);

  if (!activeProject) {
    return (
      <div className="px-4 pt-12">
        <div className="border-muted-border bg-muted-surface rounded-2xl border px-4 py-5 text-center shadow-sm">
          <div className="text-muted-foreground text-xs font-medium">No project selected.</div>
          <div className="text-subtle mt-1 text-[10px]">Open a project to search files.</div>
        </div>
      </div>
    );
  }

  return <SearchPanelWorkspace key={activeProject.id} />;
}

function SearchPanelWorkspace() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const { openTab } = useEditorStore();
  const navigate = useNavigate();
  const optsId = useId();
  const includeId = `${optsId}-include`;
  const excludeId = `${optsId}-exclude`;

  const [patternsOpen, setPatternsOpen] = useState(false);

  const {
    query,
    matchCase,
    matchWholeWord,
    useRegex,
    include,
    exclude,
    results,
    status,
    isLoadingMore,
    errorMessage,
    lastSubmittedQuery,
    totalFilesScanned,
    truncated,
    nextCursor,
    resultListResetToken,
    streamingScannedFiles,
    setQuery,
    toggleMatchCase,
    toggleMatchWholeWord,
    toggleUseRegex,
    setInclude,
    setExclude,
    submitSearch,
    loadMore,
    retry,
    stopSearch,
    clearSearch,
  } = useProjectSearch();

  const handleResultClick = useCallback(
    (result: FileSearchResult) => {
      if (!activeProject) return;

      const fakeNode = {
        name: result.path.split('/').pop() ?? '',
        path: result.path,
        type: 'file' as const,
      };
      const route = resolveFileRoute(result.path, vnextConfig, activeProject.id, activeProject.path);

      const qs = hitNavigateQuery(result);

      if (route.navigateTo) {
        if (route.type === 'config') {
          openVnextWorkspaceConfigTab(activeProject.id);
        } else {
          openEditorTabForComponentRoute(route, activeProject.id);
        }
        navigate(route.navigateTo);
        return;
      }

      if (route.editorTab) {
        openTab({
          id: route.editorTab.filePath,
          kind: 'file',
          title: route.editorTab.title,
          filePath: route.editorTab.filePath,
          language: route.editorTab.language,
        });
        navigate(
          `/project/${activeProject.id}/code/${encodeURIComponent(route.editorTab.filePath)}${qs ? `?${qs}` : ''}`,
        );
        return;
      }

      openTab({
        id: fakeNode.path,
        kind: 'file',
        title: fakeNode.name,
        filePath: fakeNode.path,
        language: 'plaintext',
      });
      navigate(`/project/${activeProject.id}/code/${encodeURIComponent(fakeNode.path)}${qs ? `?${qs}` : ''}`);
    },
    [activeProject, vnextConfig, navigate, openTab],
  );

  if (!activeProject) {
    return null;
  }

  const sidebarInput = cn(
    'border-secondary-border bg-secondary flex h-8 items-center gap-1.5 rounded-lg border px-2 transition-all',
    'focus-within:border-secondary-border-hover focus-within:ring-ring/40 focus-within:ring-[2px]',
  );
  const sidebarInputEl =
    'placeholder:text-muted-foreground/60 min-w-0 flex-1 border-0 bg-transparent text-[11px] outline-none';

  const disclosurePanelClass = cn(
    'overflow-hidden transition-[max-height] ease-out motion-reduce:transition-none',
    patternsOpen ? 'max-h-[14rem]' : 'max-h-0',
    patternsOpen ? 'duration-[180ms]' : 'duration-150',
  );

  const showIdleHint = status === 'idle' && !lastSubmittedQuery;
  const showNoResults =
    status === 'done' && results.length === 0 && lastSubmittedQuery !== null && lastSubmittedQuery !== '';
  const qForMessage = lastSubmittedQuery ?? '';

  const showResultList = results.length > 0 && (status === 'done' || status === 'streaming' || status === 'cancelled');
  const scannedForSummary =
    status === 'streaming' || status === 'cancelled' ? streamingScannedFiles : totalFilesScanned;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 pt-2">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submitSearch();
        }}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className={cn(sidebarInput, 'min-w-0 flex-1')}>
              <SearchIcon className="text-muted-foreground size-3 shrink-0" aria-hidden />
              <input
                name="workspace-search"
                className={sidebarInputEl}
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Workspace search"
                autoComplete="off"
                spellCheck={false}
              />
              {query.length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  title="Clear search"
                  className={cn(
                    'text-muted-foreground hover:bg-muted-surface hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
                  )}
                  onClick={() => clearSearch()}>
                  <X className="size-3.5 shrink-0" aria-hidden />
                </button>
              ) : null}
            </div>
            <Button
              type="submit"
              variant="default"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              aria-label="Search"
              title="Search">
              <SearchIcon className="size-3.5" aria-hidden />
            </Button>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-0.5">
            <ToggleButton active={matchCase} onClick={toggleMatchCase} title="Match Case">
              <CaseSensitive className="size-3.5" />
            </ToggleButton>
            <ToggleButton active={matchWholeWord} onClick={toggleMatchWholeWord} title="Match Whole Word">
              <WholeWord className="size-3.5" />
            </ToggleButton>
            <ToggleButton active={useRegex} onClick={toggleUseRegex} title="Use Regular Expression">
              <Regex className="size-3.5" />
            </ToggleButton>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 py-0.5 text-left text-[10px] font-medium tracking-wide uppercase"
            aria-expanded={patternsOpen}
            aria-controls={`${optsId}-patterns-panel`}
            id={`${optsId}-patterns-trigger`}
            onClick={() => setPatternsOpen((o) => !o)}>
            {patternsOpen ? (
              <ChevronDown className="size-3 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="size-3 shrink-0" aria-hidden />
            )}
            Pattern filters
          </button>
          <div id={`${optsId}-patterns-panel`} role="region" aria-labelledby={`${optsId}-patterns-trigger`} className={disclosurePanelClass}>
            <div className="flex flex-col gap-1.5 pb-1">
              <div className={sidebarInput}>
                <label htmlFor={includeId} className="sr-only">
                  Files to include
                </label>
                <input
                  id={includeId}
                  className={sidebarInputEl}
                  placeholder="e.g. src/**/*.ts"
                  value={include}
                  onChange={(e) => setInclude(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className={sidebarInput}>
                <label htmlFor={excludeId} className="sr-only">
                  Files to exclude
                </label>
                <input
                  id={excludeId}
                  className={sidebarInputEl}
                  placeholder="e.g. **/node_modules/**"
                  value={exclude}
                  onChange={(e) => setExclude(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-3">
        {showIdleHint ? (
          <p className="text-muted-foreground px-1 pt-2 text-center text-[11px] leading-snug">
            Enter text and press Search to find matches across files.
          </p>
        ) : null}

        {status === 'streaming' ? (
          <div className="text-muted-foreground flex shrink-0 items-center justify-between gap-2 border-border/60 border-b px-1 py-2 text-[11px]">
            <div className="flex min-w-0 items-center gap-1.5">
              <Loader2 className="text-brand-from size-3.5 shrink-0 animate-spin" aria-hidden />
              <span aria-live="polite">
                Searching... ({streamingScannedFiles} file{streamingScannedFiles !== 1 ? 's' : ''} scanned)
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-[10px]" onClick={() => stopSearch()}>
              Stop
            </Button>
          </div>
        ) : null}

        {status === 'cancelled' && results.length === 0 ? (
          <p className="text-muted-foreground px-1 pt-2 text-center text-[11px] leading-snug" aria-live="polite">
            Search stopped. No results found so far.
          </p>
        ) : null}

        {status === 'cancelled' && results.length > 0 ? (
          <p className="text-muted-foreground border-border/60 border-b px-1 py-2 text-[11px] leading-snug" aria-live="polite">
            Search stopped. {results.length} result{results.length !== 1 ? 's' : ''} found so far.
          </p>
        ) : null}

        {status === 'streaming' && results.length === 0 ? <SearchSkeleton /> : null}

        {status === 'error' && errorMessage ? (
          <div className="px-1 pt-2" role="alert">
            <p className="text-destructive-foreground mb-2 text-[11px] leading-snug">{errorMessage}</p>
            <Button type="button" variant="outline" size="sm" className="h-7 w-full text-[11px]" onClick={() => void retry()}>
              Retry
            </Button>
          </div>
        ) : null}

        {showNoResults ? (
          <div className="px-1 pt-2 text-center">
            <p className="text-muted-foreground text-[11px] leading-snug">
              No results found for <span className="text-foreground font-medium">{`"${qForMessage}".`}</span>
            </p>
            <p className="text-muted-foreground mt-1 text-[10px] leading-snug">
              Try a shorter query, turn off Regex, or widen include patterns / narrow exclude patterns.
            </p>
          </div>
        ) : null}

        {showResultList ? (
          <SearchResultList
            key={resultListResetToken}
            results={results}
            query={lastSubmittedQuery ?? query}
            matchCase={matchCase}
            useRegex={useRegex}
            projectPath={activeProject.path}
            totalFilesScanned={scannedForSummary}
            isStreaming={status === 'streaming'}
            truncated={truncated}
            hasMore={Boolean(nextCursor)}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => void loadMore()}
            onResultClick={handleResultClick}
          />
        ) : null}
      </div>
    </div>
  );
}
