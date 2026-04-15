import { useCallback, useEffect, useRef, useState } from 'react';

import { useProjectStore } from '@app/store/useProjectStore';
import { createLogger } from '@shared/lib/logger/CreateLogger';

import { searchFiles, type FileSearchResult } from '@modules/project-workspace/WorkspaceApi';

const logger = createLogger('useProjectSearch');

const DEBOUNCE_MS = 300;

export type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

export interface ProjectSearchState {
  query: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  include: string;
  exclude: string;
  results: FileSearchResult[];
  status: SearchStatus;
  errorMessage: string | null;
  setQuery: (query: string) => void;
  toggleMatchCase: () => void;
  toggleMatchWholeWord: () => void;
  toggleUseRegex: () => void;
  setInclude: (value: string) => void;
  setExclude: (value: string) => void;
  clearResults: () => void;
}

export function useProjectSearch(): ProjectSearchState {
  const { activeProject } = useProjectStore();

  const [query, setQueryState] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  const runSearch = useCallback(
    async (
      q: string,
      opts: {
        matchCase: boolean;
        matchWholeWord: boolean;
        useRegex: boolean;
        include: string;
        exclude: string;
      },
    ) => {
      if (!activeProject || !q.trim()) {
        setResults([]);
        setStatus('idle');
        return;
      }

      abortRef.current = false;
      setStatus('loading');
      setErrorMessage(null);

      try {
        const response = await searchFiles({
          query: q,
          projectPath: activeProject.path,
          matchCase: opts.matchCase,
          matchWholeWord: opts.matchWholeWord,
          useRegex: opts.useRegex,
          include: opts.include || undefined,
          exclude: opts.exclude || undefined,
        });

        if (abortRef.current) return;

        if (!response.success) {
          setErrorMessage(response.error.message);
          setStatus('error');
          setResults([]);
          return;
        }

        setResults(response.data);
        setStatus('done');
      } catch (err) {
        if (abortRef.current) return;
        logger.error('Search failed', err);
        setErrorMessage('Search failed. Please try again.');
        setStatus('error');
        setResults([]);
      }
    },
    [activeProject],
  );

  const scheduleSearch = useCallback(
    (
      q: string,
      opts: {
        matchCase: boolean;
        matchWholeWord: boolean;
        useRegex: boolean;
        include: string;
        exclude: string;
      },
    ) => {
      abortRef.current = true;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      if (!q.trim()) {
        setResults([]);
        setStatus('idle');
        setErrorMessage(null);
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        void runSearch(q, opts);
      }, DEBOUNCE_MS);
    },
    [runSearch],
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);
      scheduleSearch(q, { matchCase, matchWholeWord, useRegex, include, exclude });
    },
    [scheduleSearch, matchCase, matchWholeWord, useRegex, include, exclude],
  );

  const toggleMatchCase = useCallback(() => {
    setMatchCase((prev) => {
      const next = !prev;
      scheduleSearch(query, { matchCase: next, matchWholeWord, useRegex, include, exclude });
      return next;
    });
  }, [scheduleSearch, query, matchWholeWord, useRegex, include, exclude]);

  const toggleMatchWholeWord = useCallback(() => {
    setMatchWholeWord((prev) => {
      const next = !prev;
      scheduleSearch(query, { matchCase, matchWholeWord: next, useRegex, include, exclude });
      return next;
    });
  }, [scheduleSearch, query, matchCase, useRegex, include, exclude]);

  const toggleUseRegex = useCallback(() => {
    setUseRegex((prev) => {
      const next = !prev;
      scheduleSearch(query, { matchCase, matchWholeWord, useRegex: next, include, exclude });
      return next;
    });
  }, [scheduleSearch, query, matchCase, matchWholeWord, include, exclude]);

  const setIncludeAndSearch = useCallback(
    (value: string) => {
      setInclude(value);
      scheduleSearch(query, { matchCase, matchWholeWord, useRegex, include: value, exclude });
    },
    [scheduleSearch, query, matchCase, matchWholeWord, useRegex, exclude],
  );

  const setExcludeAndSearch = useCallback(
    (value: string) => {
      setExclude(value);
      scheduleSearch(query, { matchCase, matchWholeWord, useRegex, include, exclude: value });
    },
    [scheduleSearch, query, matchCase, matchWholeWord, useRegex, include],
  );

  const clearResults = useCallback(() => {
    abortRef.current = true;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setResults([]);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  // Clear results when active project changes
  useEffect(() => {
    clearResults();
    setQueryState('');
  }, [activeProject?.id, clearResults]);

  return {
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
    setInclude: setIncludeAndSearch,
    setExclude: setExcludeAndSearch,
    clearResults,
  };
}
