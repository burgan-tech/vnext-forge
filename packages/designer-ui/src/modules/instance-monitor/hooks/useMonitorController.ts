import { useCallback, useEffect, useReducer, useRef } from 'react';

import { defaultMonitorLoaders, loadMonitorLevelSafe, type MonitorLoaders } from '../data/loadMonitorLevel';
import { initialMonitorState, monitorReducer } from '../model/monitorReducer';
import type { MonitorSelection, MonitorTarget } from '../types';

/** Load / refresh / selection state for one mounted monitor. */
export function useMonitorController(
  target: MonitorTarget,
  headers: Record<string, string>,
  loaders: MonitorLoaders = defaultMonitorLoaders,
) {
  const [state, dispatch] = useReducer(monitorReducer, initialMonitorState);
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const targetRef = useRef(target);
  targetRef.current = target;
  const seq = useRef(0);

  const targetKey = [target.domain, target.workflowKey, target.instanceId, target.workflowFilePath ?? '', target.runtimeUrl ?? ''].join('|');

  const run = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const id = ++seq.current;
      dispatch({ type: mode === 'initial' ? 'load-start' : 'refresh-start' });
      const result = await loadMonitorLevelSafe(targetRef.current, headersRef.current, loaders);
      if (id === seq.current) dispatch({ type: 'load-done', result });
    },
    [loaders],
  );

  useEffect(() => {
    void run('initial');
  }, [run, targetKey]);

  return {
    load: state.load,
    selection: state.selection,
    pathOnly: state.pathOnly,
    refresh: useCallback(() => void run('refresh'), [run]),
    select: useCallback((selection: MonitorSelection) => dispatch({ type: 'select', selection }), []),
    setPathOnly: useCallback((value: boolean) => dispatch({ type: 'path-only', value }), []),
  };
}
