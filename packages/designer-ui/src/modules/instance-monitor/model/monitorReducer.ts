import type { MonitorLoadResult } from '../data/loadMonitorLevel';
import type { MonitorLoadState, MonitorSelection } from '../types';

export interface MonitorState {
  load: MonitorLoadState;
  selection: MonitorSelection;
  pathOnly: boolean;
}

export const initialMonitorState: MonitorState = { load: { kind: 'loading' }, selection: null, pathOnly: false };

export type MonitorAction =
  | { type: 'load-start' }
  | { type: 'refresh-start' }
  | { type: 'load-done'; result: MonitorLoadResult }
  | { type: 'select'; selection: MonitorSelection }
  | { type: 'path-only'; value: boolean };

export function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case 'load-start':
      return { ...state, load: { kind: 'loading' }, selection: null };
    case 'refresh-start':
      return state.load.kind === 'ready'
        ? { ...state, load: { ...state.load, refreshing: true } }
        : { ...state, load: { kind: 'loading' } };
    case 'load-done': {
      const r = action.result;
      if (r.ok) return { ...state, load: { kind: 'ready', data: r.data, refreshing: false, staleError: null } };
      if (state.load.kind === 'ready') return { ...state, load: { ...state.load, refreshing: false, staleError: r.error } };
      return { ...state, load: r.notFound ? { kind: 'not-found' } : { kind: 'error', error: r.error } };
    }
    case 'select':
      return { ...state, selection: action.selection };
    case 'path-only':
      return { ...state, pathOnly: action.value };
  }
}
