import { useCallback, useEffect, useReducer, useRef } from 'react';

import { defaultMonitorLoaders, loadMonitorLevelSafe, type MonitorLoaders } from '../data/loadMonitorLevel';
import { initialMonitorState, monitorReducer } from '../model/monitorReducer';
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

  return {
    load: state.load,
    selection: top.selection,
    pathOnly: state.pathOnly,
    paused: state.paused,
    levels: state.stack.map((e) => e.target),
    level,
    refresh: useCallback(() => void run('refresh'), [run]),
    select: useCallback((selection: MonitorSelection) => dispatch({ type: 'select', selection }), []),
    setPathOnly: useCallback((value: boolean) => dispatch({ type: 'path-only', value }), []),
    setPaused: useCallback((value: boolean) => dispatch({ type: 'paused', value }), []),
    drill: useCallback((target: MonitorTarget) => dispatch({ type: 'drill', target }), []),
    popTo: useCallback((index: number) => dispatch({ type: 'pop-to', index }), []),
  };
}
