import { useCallback } from 'react';

import { useNavigate } from 'react-router-dom';
import { CaseSensitive, Regex, Search, WholeWord } from 'lucide-react';

import {
  cn,
  useEditorStore,
  useProjectStore,
  type FileSearchResult,
} from '@vnext-forge/designer-ui';

import { openEditorTabForComponentRoute } from '../project-workspace/openEditorTabFromFileRoute';
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

export function SearchPanel() {
  const { activeProject, vnextConfig } = useProjectStore();
  const { openTab } = useEditorStore();
  const navigate = useNavigate();

  const {
    query,
    matchCase,
    matchWholeWord,
    useRegex,
    include,
    exclude,
    results,
    status,
    errorMessage,
    setQuery,
    toggleMatchCase,
    toggleMatchWholeWord,
    toggleUseRegex,
    setInclude,
    setExclude,
  } = useProjectSearch();

  const handleResultClick = useCallback(
    (result: FileSearchResult) => {
      if (!activeProject) return;

      const fakeNode = { name: result.path.split('/').pop() ?? '', path: result.path, type: 'file' as const };
      const route = resolveFileRoute(result.path, vnextConfig, activeProject.id, activeProject.path);

      if (route.navigateTo) {
        openEditorTabForComponentRoute(route, activeProject.id);
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
        navigate(`/project/${activeProject.id}/code/${encodeURIComponent(route.editorTab.filePath)}`);
        return;
      }

      // Fallback: open as generic code tab
      openTab({
        id: fakeNode.path,
        kind: 'file',
        title: fakeNode.name,
        filePath: fakeNode.path,
        language: 'plaintext',
      });
      navigate(`/project/${activeProject.id}/code/${encodeURIComponent(fakeNode.path)}`);
    },
    [activeProject, vnextConfig, navigate, openTab],
  );

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

  const sidebarInput = cn(
    'border-secondary-border bg-secondary flex h-7 items-center gap-1.5 rounded-lg border px-2 transition-all',
    'focus-within:border-secondary-border-hover focus-within:ring-ring/40 focus-within:ring-[2px]',
  );
  const sidebarInputEl =
    'placeholder:text-muted-foreground/60 min-w-0 flex-1 border-0 bg-transparent text-[11px] outline-none';

  return (
    <div className="flex flex-col gap-1.5 px-3 pt-2">
      {/* Query row */}
      <div className="flex items-center gap-1">
        <div className={cn(sidebarInput, 'flex-1')}>
          <Search className="text-muted-foreground size-3 shrink-0" />
          <input
            className={sidebarInputEl}
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ToggleButton active={matchCase} onClick={toggleMatchCase} title="Match Case (Alt+C)">
            <CaseSensitive className="size-3.5" />
          </ToggleButton>
          <ToggleButton
            active={matchWholeWord}
            onClick={toggleMatchWholeWord}
            title="Match Whole Word (Alt+W)">
            <WholeWord className="size-3.5" />
          </ToggleButton>
          <ToggleButton
            active={useRegex}
            onClick={toggleUseRegex}
            title="Use Regular Expression (Alt+R)">
            <Regex className="size-3.5" />
          </ToggleButton>
        </div>
      </div>

      {/* Files to include */}
      <div className={sidebarInput}>
        <input
          className={sidebarInputEl}
          placeholder="files to include (e.g. **/*.json)"
          value={include}
          onChange={(e) => setInclude(e.target.value)}
        />
      </div>

      {/* Files to exclude */}
      <div className={sidebarInput}>
        <input
          className={sidebarInputEl}
          placeholder="files to exclude (e.g. **/*.md)"
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
        />
      </div>

      {/* Results area */}
      <div className="mt-1">
        {status === 'loading' && (
          <div className="text-muted-foreground px-1 py-4 text-center text-[11px]">
            Searching…
          </div>
        )}

        {status === 'error' && (
          <div className="text-destructive-foreground px-1 py-4 text-center text-[11px]">
            {errorMessage ?? 'Search failed.'}
          </div>
        )}

        {status === 'done' && results.length === 0 && (
          <div className="text-muted-foreground px-1 py-4 text-center text-[11px]">
            No results for <span className="font-medium">"{query}"</span>
          </div>
        )}

        {status === 'done' && results.length > 0 && (
          <SearchResultList
            results={results}
            query={query}
            matchCase={matchCase}
            projectPath={activeProject.path}
            onResultClick={handleResultClick}
          />
        )}

        {status === 'idle' && !query && (
          <div className="text-muted-foreground mt-4 px-1 text-center text-[10px]">
            Type to search across project files
          </div>
        )}
      </div>
    </div>
  );
}
