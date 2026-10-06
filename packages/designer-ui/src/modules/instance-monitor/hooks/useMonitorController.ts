import { useCallback, useEffect, useReducer, useRef } from 'react';

import { subscribeInstanceChanges } from '../bus/instanceChangeBus';
import * as QuickRunApi from '../../quick-run/QuickRunApi';
import { defaultMonitorLoaders, loadMonitorLevelSafe, type MonitorLoaders } from '../data/loadMonitorLevel';
import { initialMonitorState, monitorReducer } from '../model/monitorReducer';
import { nextPollDelay } from '../model/pollSchedule';
import type { MonitorSelection, MonitorTarget } from '../types';

const keyOf = (t: MonitorTarget) =>
  [t.domain, t.workflowKey, t.instanceId, t.workflowFilePath ?? '', t.runtimeUrl ?? ''].join('|');

/** Load / refresh / selection / drill-down state for one mounted monitor. */
export function useMonitorController(
  rootTarget: MonitorTarget,
  headers: Record<string, string>,
  runtimeVersion?: string | null,
  loaders: MonitorLoaders = defaultMonitorLoaders,
) {
  const [state, dispatch] = useReducer(monitorReducer, rootTarget, initialMonitorState);
  const top = state.stack[state.stack.length - 1];
  const level = top.target;

  const headersRef = useRef(headers);
  headersRef.current = headers;
  const levelRef = useRef(level);
  levelRef.current = level;
  const versionRef = useRef(runtimeVersion);
  versionRef.current = runtimeVersion;
  const loadKindRef = useRef(state.load.kind);
  loadKindRef.current = state.load.kind;
  const seq = useRef(0);

  const rootKey = keyOf(rootTarget);
  const levelKey = `${keyOf(level)}#${state.gen}`;

  const run = useCallback(
    async (mode: 'initial' | 'refresh' | 'switch') => {
      const id = ++seq.current;
      // 'switch': reset / drill / pop-to already put the reducer in `loading`.
      if (mode !== 'switch') dispatch({ type: mode === 'initial' ? 'load-start' : 'refresh-start' });
      const result = await loadMonitorLevelSafe(levelRef.current, headersRef.current, loaders, {
        runtimeVersion: versionRef.current ?? undefined,
      });
      if (id === seq.current) dispatch({ type: 'load-done', result });
    },
    [loaders],
  );

  // The root target prop changed (skip the mount).
  const rootTargetRef = useRef(rootTarget);
  rootTargetRef.current = rootTarget;
  const lastRootKey = useRef(rootKey);
  useEffect(() => {
    if (lastRootKey.current === rootKey) return;
    lastRootKey.current = rootKey;
    dispatch({ type: 'reset', target: rootTargetRef.current });
  }, [rootKey]);

  // Load the top level when its target changes. The runtime version is deliberately not part
  // of the key: it arrives after mount and only refreshes (below).
  useEffect(() => {
    void run('switch');
  }, [run, levelKey]);

  const lastVersion = useRef(runtimeVersion);
  useEffect(() => {
    if (lastVersion.current === runtimeVersion) return;
    lastVersion.current = runtimeVersion;
    if (loadKindRef.current === 'ready') void run('refresh');
  }, [run, runtimeVersion]);

  const refresh = useCallback(() => void run('refresh'), [run]);

  // Live: Quick Run (or another webview) says one of the viewed instances changed.
  const levelIdsRef = useRef<string[]>([]);
  levelIdsRef.current = state.stack.map((e) => e.target.instanceId);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribeInstanceChanges((event) => {
      if (!levelIdsRef.current.includes(event.instanceId)) return;
      clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current(), 300);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  // Live: light polling of the current level while its instance is active.
  const readyData = state.load.kind === 'ready' ? state.load.data : null;
  const status = readyData?.instance.metadata.status;
  const modifiedAt = readyData?.instance.metadata.modifiedAt;
  const loadedAt = readyData?.loadedAt;
  const paused = state.paused;
  useEffect(() => {
    if (typeof document === 'undefined' || loadedAt === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const lastChangeAt = loadedAt;
    const arm = () => {
      clearTimeout(timer);
      const delay = nextPollDelay({
        status,
        unchangedForMs: Date.now() - lastChangeAt,
        visible: document.visibilityState !== 'hidden',
        paused,
      });
      if (delay === null || cancelled) return;
      timer = setTimeout(() => void tick(), delay);
    };
    const tick = async () => {
      const target = levelRef.current;
      const res = await QuickRunApi.getInstance({
        domain: target.domain,
        workflowKey: target.workflowKey,
        instanceId: target.instanceId,
        headers: headersRef.current,
        ...(target.runtimeUrl ? { runtimeUrl: target.runtimeUrl } : {}),
      });
      if (cancelled) return;
      if (res.success && res.data.metadata.modifiedAt !== modifiedAt) {
        refreshRef.current();
        return; // the reload re-arms this effect with fresh data
      }
      arm();
    };
    document.addEventListener('visibilitychange', arm);
    arm();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [status, modifiedAt, loadedAt, paused, levelKey]);

  return {
    load: state.load,
    selection: top.selection,
    pathOnly: state.pathOnly,
    paused: state.paused,
    levels: state.stack.map((e) => e.target),
    level,
    refresh,
    select: useCallback((selection: MonitorSelection) => dispatch({ type: 'select', selection }), []),
    setPathOnly: useCallback((value: boolean) => dispatch({ type: 'path-only', value }), []),
    setPaused: useCallback((value: boolean) => dispatch({ type: 'paused', value }), []),
    drill: useCallback((target: MonitorTarget) => dispatch({ type: 'drill', target }), []),
    popTo: useCallback((index: number) => dispatch({ type: 'pop-to', index }), []),
  };
}
