import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger, searchFiles, useProjectStore, type FileSearchResult } from '@vnext-forge-studio/designer-ui';

import { config } from '@shared/config/config';
import { createTraceInjectingFetch } from '@shared/api/trace-headers';

const logger = createLogger('useProjectSearch');

const streamedFetch = createTraceInjectingFetch(fetch.bind(globalThis));

/** POST JSON body mirrors `WorkspaceApi.searchFiles` → registry `files/search`. */
function buildFilesSearchBody(opts: {
  query: string;
  projectPath: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  include: string;
  exclude: string;
}): Record<string, unknown> {
  return {
    q: opts.query,
    project: opts.projectPath,
    ...(opts.matchCase ? { matchCase: true } : {}),
    ...(opts.matchWholeWord ? { matchWholeWord: true } : {}),
    ...(opts.useRegex ? { useRegex: true } : {}),
    ...(opts.include.trim() !== '' ? { include: opts.include } : {}),
    ...(opts.exclude.trim() !== '' ? { exclude: opts.exclude } : {}),
  };
}

interface SseFrameParsed {
  event: string;
  data: string;
}

function appendSseFrames(buffer: string, chunk: string): { frames: SseFrameParsed[]; rest: string } {
  const combined = buffer + chunk;
  const frames: SseFrameParsed[] = [];
  let start = 0;

  while (true) {
    const sep = combined.indexOf('\n\n', start);
    if (sep < 0) {
      return { frames, rest: combined.slice(start) };
    }

    const raw = combined.slice(start, sep).replace(/\r\n/g, '\n');
    start = sep + 2;

    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || eventName;
      } else if (line.startsWith('data:')) {
        dataLines.push(line.startsWith('data: ') ? line.slice(6) : line.slice(5));
      }
    }
    if (dataLines.length > 0) {
      frames.push({ event: eventName, data: dataLines.join('\n') });
    }
  }
}

const FLUSH_MS = 50;

export type SearchStatus = 'idle' | 'streaming' | 'done' | 'cancelled' | 'error';

export interface ProjectSearchState {
  query: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  include: string;
  exclude: string;
  results: FileSearchResult[];
  status: SearchStatus;
  isLoadingMore: boolean;
  errorMessage: string | null;
  lastSubmittedQuery: string | null;
  /** Total files scanned (final from `done` or non-streaming path). */
  totalFilesScanned: number;
  /** Live count from SSE `progress` while streaming. */
  streamingScannedFiles: number;
  truncated: boolean;
  nextCursor: string | undefined;
  /** Bumps on each new search (not load-more) so result list UI can reset local “show more” caps. */
  resultListResetToken: number;
  setQuery: (query: string) => void;
  toggleMatchCase: () => void;
  toggleMatchWholeWord: () => void;
  toggleUseRegex: () => void;
  setInclude: (value: string) => void;
  setExclude: (value: string) => void;
  submitSearch: () => Promise<void>;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
  stopSearch: () => void;
  clearSearch: () => void;
}

export function useProjectSearch(): ProjectSearchState {
  const { activeProject } = useProjectStore();

  const [query, setQueryState] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [include, setIncludeState] = useState('');
  const [exclude, setExcludeState] = useState('');
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState<string | null>(null);
  const [totalFilesScanned, setTotalFilesScanned] = useState(0);
  const [streamingScannedFiles, setStreamingScannedFiles] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [resultListResetToken, setResultListResetToken] = useState(0);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  /** True only when explicit Stop was used for the current aborted request. */
  const userStoppedRef = useRef(false);
  const pendingMatchesRef = useRef<FileSearchResult[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushGenRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushMatchesNow = useCallback((expectedGen: number) => {
    if (expectedGen !== requestIdRef.current) return;
    const pending = pendingMatchesRef.current.splice(0);
    if (pending.length === 0) return;
    setResults((prev) => [...prev, ...pending]);
  }, []);

  const scheduleMatchFlush = useCallback(
    (expectedGen: number) => {
      flushGenRef.current = expectedGen;
      if (flushTimerRef.current !== null) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushMatchesNow(flushGenRef.current);
      }, FLUSH_MS);
    },
    [flushMatchesNow],
  );

  const enqueueMatches = useCallback(
    (expectedGen: number, matches: FileSearchResult[]) => {
      if (matches.length === 0) return;
      pendingMatchesRef.current.push(...matches);
      scheduleMatchFlush(expectedGen);
    },
    [scheduleMatchFlush],
  );

  const abortDueToUnmountOrReplace = useCallback(() => {
    userStoppedRef.current = false;
    abortRef.current?.abort();
  }, []);

  const stopSearch = useCallback(() => {
    userStoppedRef.current = true;
    abortRef.current?.abort();
  }, []);

  const clearSearch = useCallback(() => {
    requestIdRef.current += 1;
    clearTimers();
    pendingMatchesRef.current = [];
    userStoppedRef.current = false;
    abortDueToUnmountOrReplace();
    setQueryState('');
    setResults([]);
    setStatus('idle');
    setIsLoadingMore(false);
    setErrorMessage(null);
    setLastSubmittedQuery(null);
    setTotalFilesScanned(0);
    setStreamingScannedFiles(0);
    setTruncated(false);
    setNextCursor(undefined);
    setResultListResetToken(0);
  }, [abortDueToUnmountOrReplace, clearTimers]);

  useEffect(() => () => {
    abortDueToUnmountOrReplace();
    clearTimers();
  }, [abortDueToUnmountOrReplace, clearTimers]);

  const runNonStreamingSearch = useCallback(
    async (q: string, cursor: string | undefined, append: boolean, myId: number) => {
      if (!activeProject || !q.trim()) {
        if (!append && myId === requestIdRef.current) {
          setResults([]);
          setStatus('idle');
          setLastSubmittedQuery(null);
          setTotalFilesScanned(0);
          setStreamingScannedFiles(0);
          setTruncated(false);
          setNextCursor(undefined);
        }
        return;
      }

      if (append) {
        if (myId === requestIdRef.current) setIsLoadingMore(true);
      }

      try {
        const response = await searchFiles({
          query: q,
          projectPath: activeProject.path,
          matchCase,
          matchWholeWord,
          useRegex,
          include: include || undefined,
          exclude: exclude || undefined,
          cursor,
        });

        if (myId !== requestIdRef.current) return;

        if (!response.success) {
          setErrorMessage(response.error.message);
          setStatus('error');
          if (!append) {
            setResults([]);
            setTotalFilesScanned(0);
            setStreamingScannedFiles(0);
            setTruncated(false);
            setNextCursor(undefined);
          }
          return;
        }

        const { items, totalFiles, truncated: serverTruncated, nextCursor: cursorNext } = response.data;

        setTotalFilesScanned(totalFiles);
        setStreamingScannedFiles(totalFiles);
        setTruncated(serverTruncated);
        setNextCursor(cursorNext);

        if (append) {
          setResults((prev) => [...prev, ...items]);
        } else {
          setResults(items);
        }
        setStatus('done');
      } catch (err) {
        if (myId !== requestIdRef.current) return;
        logger.error('Search failed', err);
        setErrorMessage('Search failed. Please try again.');
        setStatus('error');
        if (!append) {
          setResults([]);
          setTotalFilesScanned(0);
          setStreamingScannedFiles(0);
          setTruncated(false);
          setNextCursor(undefined);
        }
      } finally {
        if (myId === requestIdRef.current) {
          setIsLoadingMore(false);
        }
      }
    },
    [activeProject, matchCase, matchWholeWord, useRegex, include, exclude],
  );

  const runSearchViaSseThenFallback = useCallback(
    async (qRaw: string) => {
      const q = qRaw.trim();
      if (!activeProject || !q) {
        return;
      }

      const myId = ++requestIdRef.current;

      abortDueToUnmountOrReplace();
      userStoppedRef.current = false;
      clearTimers();
      pendingMatchesRef.current.splice(0);
      flushGenRef.current = myId;

      const ac = new AbortController();
      abortRef.current = ac;

      setResults([]);
      setResultListResetToken((t) => t + 1);
      setStatus('streaming');
      setErrorMessage(null);
      setLastSubmittedQuery(q);
      setTruncated(false);
      setNextCursor(undefined);
      setTotalFilesScanned(0);
      setStreamingScannedFiles(0);

      const apiRoot = `${config.apiBaseUrl.replace(/\/?$/u, '')}/api/v1/files/search/stream`;

      let receivedDone = false;
      let serverStreamError: string | null = null;

      const tryConsumeStream = async (): Promise<boolean> => {
        let response: Response;
        try {
          response = await streamedFetch(apiRoot, {
            method: 'POST',
            headers: {
              Accept: 'text/event-stream',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              buildFilesSearchBody({
                query: q,
                projectPath: activeProject.path,
                matchCase,
                matchWholeWord,
                useRegex,
                include,
                exclude,
              }),
            ),
            signal: ac.signal,
          });
        } catch (cause) {
          if (
            cause instanceof DOMException &&
            cause.name === 'AbortError' &&
            !userStoppedRef.current &&
            myId !== requestIdRef.current
          ) {
            return false;
          }
          if (
            cause instanceof DOMException &&
            cause.name === 'AbortError' &&
            userStoppedRef.current &&
            myId === requestIdRef.current
          ) {
            flushMatchesNow(myId);
            setStatus('cancelled');
            return false;
          }
          throw cause;
        }

        if (!response.ok) {
          logger.warn(`files/search/stream HTTP ${String(response.status)} — falling back to files/search`);
          return false;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          logger.warn('files/search/stream missing body reader — falling back to files/search');
          return false;
        }

        const decoder = new TextDecoder();
        let carry = '';

        const handleSseFrame = (frame: SseFrameParsed): boolean | 'stop' => {
          if (myId !== requestIdRef.current) return 'stop';

          if (frame.event === 'progress') {
            try {
              const payload = JSON.parse(frame.data) as { scannedFiles?: number };
              if (typeof payload.scannedFiles === 'number' && Number.isFinite(payload.scannedFiles)) {
                setStreamingScannedFiles(payload.scannedFiles);
              }
            } catch {
              /* ignore malformed progress frame */
            }
            return true;
          }

          if (frame.event === 'match') {
            try {
              const hit = JSON.parse(frame.data) as {
                path: string;
                line: number;
                column?: number;
                text: string;
                matchLength?: number;
              };
              if (typeof hit.path === 'string' && typeof hit.line === 'number' && typeof hit.text === 'string') {
                const row: FileSearchResult = {
                  path: hit.path,
                  line: hit.line,
                  column: typeof hit.column === 'number' ? hit.column : 1,
                  text: hit.text,
                  matchLength: typeof hit.matchLength === 'number' ? hit.matchLength : 0,
                };
                enqueueMatches(myId, [row]);
              }
            } catch {
              /* ignore malformed match frame */
            }
            return true;
          }

          if (frame.event === 'done') {
            try {
              const payload = JSON.parse(frame.data) as {
                totalFiles?: number;
                totalMatches?: number;
                truncated?: boolean;
              };
              flushMatchesNow(myId);
              clearTimers();
              if (typeof payload.totalFiles === 'number' && Number.isFinite(payload.totalFiles)) {
                setTotalFilesScanned(payload.totalFiles);
                setStreamingScannedFiles(payload.totalFiles);
              }
              if (typeof payload.truncated === 'boolean') {
                setTruncated(payload.truncated);
              }
              setNextCursor(undefined);
              receivedDone = true;
              setStatus('done');
            } catch {
              serverStreamError = 'Search completed but the summary was malformed.';
              return false;
            }
            return true;
          }

          if (frame.event === 'error') {
            try {
              const payload = JSON.parse(frame.data) as { message?: string };
              serverStreamError = typeof payload.message === 'string' ? payload.message : 'Search failed.';
            } catch {
              serverStreamError = 'Search failed.';
            }
            flushMatchesNow(myId);
            clearTimers();
            if (myId === requestIdRef.current) {
              setErrorMessage(serverStreamError);
              setStatus('error');
            }
            return false;
          }

          return true;
        };

        try {
          while (true) {
            if (myId !== requestIdRef.current && !receivedDone && !serverStreamError) {
              reader.cancel().catch(() => undefined);
              return false;
            }

            const chunk = await reader.read();
            if (chunk.done) {
              carry += decoder.decode();
              break;
            }

            const { frames, rest } = appendSseFrames(carry, decoder.decode(chunk.value, { stream: true }));
            carry = rest;

            for (const frame of frames) {
              const out = handleSseFrame(frame);
              if (out === 'stop') return false;
              if (out === false) return false;
              if (receivedDone) return true;
            }
          }

          {
            const { frames, rest } = appendSseFrames(carry, '');
            carry = rest;
            for (const frame of frames) {
              const out = handleSseFrame(frame);
              if (out === 'stop') return false;
              if (out === false) return false;
              if (receivedDone) return true;
            }
          }
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === 'AbortError') {
            flushMatchesNow(myId);
            clearTimers();
            if (userStoppedRef.current && myId === requestIdRef.current) {
              setStatus('cancelled');
              return false;
            }
            return false;
          }
          logger.warn('files/search/stream read failure — falling back to files/search', cause);
          return false;
        } finally {
          clearTimers();
        }

        if (serverStreamError) {
          return false;
        }

        flushMatchesNow(myId);

        if (receivedDone) {
          return true;
        }

        logger.warn('files/search/stream closed without done event — falling back to files/search');
        return false;
      };

      let streamWorked = false;
      try {
        streamWorked = await tryConsumeStream();
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          flushMatchesNow(myId);
          clearTimers();
          if (userStoppedRef.current && myId === requestIdRef.current) {
            setStatus('cancelled');
          }
          return;
        }
        logger.warn('files/search/stream failed — falling back to files/search', cause);
      }

      if (!streamWorked && myId === requestIdRef.current && !serverStreamError) {
        if (userStoppedRef.current) {
          setStatus('cancelled');
          return;
        }
        await runNonStreamingSearch(q, undefined, false, myId);
      }

      abortRef.current = null;
    },
    [
      activeProject,
      matchCase,
      matchWholeWord,
      useRegex,
      include,
      exclude,
      abortDueToUnmountOrReplace,
      clearTimers,
      enqueueMatches,
      flushMatchesNow,
      runNonStreamingSearch,
    ],
  );

  const submitSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      abortDueToUnmountOrReplace();
      requestIdRef.current += 1;
      clearTimers();
      pendingMatchesRef.current.splice(0);
      setResults([]);
      setStatus('idle');
      setLastSubmittedQuery(null);
      setTotalFilesScanned(0);
      setStreamingScannedFiles(0);
      setTruncated(false);
      setNextCursor(undefined);
      setErrorMessage(null);
      return;
    }
    await runSearchViaSseThenFallback(q);
  }, [query, runSearchViaSseThenFallback, abortDueToUnmountOrReplace, clearTimers]);

  const loadMore = useCallback(async () => {
    const q = lastSubmittedQuery ?? query.trim();
    if (!nextCursor || !q || isLoadingMore || status !== 'done') return;
    const myId = ++requestIdRef.current;
    await runNonStreamingSearch(q, nextCursor, true, myId);
  }, [lastSubmittedQuery, query, nextCursor, isLoadingMore, status, runNonStreamingSearch]);

  const retry = useCallback(async () => {
    const q = lastSubmittedQuery ?? query.trim();
    if (!q) {
      await submitSearch();
      return;
    }
    await runSearchViaSseThenFallback(q);
  }, [lastSubmittedQuery, query, submitSearch, runSearchViaSseThenFallback]);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
  }, []);

  const toggleMatchCase = useCallback(() => {
    setMatchCase((prev) => !prev);
  }, []);

  const toggleMatchWholeWord = useCallback(() => {
    setMatchWholeWord((prev) => !prev);
  }, []);

  const toggleUseRegex = useCallback(() => {
    setUseRegex((prev) => !prev);
  }, []);

  const setInclude = useCallback((value: string) => {
    setIncludeState(value);
  }, []);

  const setExclude = useCallback((value: string) => {
    setExcludeState(value);
  }, []);

  return {
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
    streamingScannedFiles,
    truncated,
    nextCursor,
    resultListResetToken,
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
  };
}
