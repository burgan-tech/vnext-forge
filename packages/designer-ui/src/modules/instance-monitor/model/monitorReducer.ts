import type { MonitorLoadResult } from '../data/loadMonitorLevel';
import type { MonitorLoadState, MonitorSelection, MonitorTarget } from '../types';

export interface MonitorLevel {
  target: MonitorTarget;
  selection: MonitorSelection;
}

export interface MonitorState {
  load: MonitorLoadState;
  /** Index 0 = root instance; the last entry is the level on screen. */
  stack: MonitorLevel[];
  /** Bumped by reset / drill / pop-to so the host effect reloads even when the level key is unchanged. */
  gen: number;
  paused: boolean;
  pathOnly: boolean;
}

export function initialMonitorState(target: MonitorTarget): MonitorState {
  return { load: { kind: 'loading' }, stack: [{ target, selection: null }], gen: 0, paused: false, pathOnly: false };
}

export type MonitorAction =
  | { type: 'reset'; target: MonitorTarget }
  | { type: 'drill'; target: MonitorTarget }
  | { type: 'pop-to'; index: number }
  | { type: 'load-start' }
  | { type: 'refresh-start' }
  | { type: 'load-done'; result: MonitorLoadResult }
  | { type: 'select'; selection: MonitorSelection }
  | { type: 'path-only'; value: boolean }
  | { type: 'paused'; value: boolean };

function withTop(state: MonitorState, selection: MonitorSelection): MonitorLevel[] {
  return state.stack.map((e, i) => (i === state.stack.length - 1 ? { ...e, selection } : e));
}

export function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case 'reset':
      return { ...state, gen: state.gen + 1, load: { kind: 'loading' }, stack: [{ target: action.target, selection: null }] };
    case 'drill':
      return { ...state, gen: state.gen + 1, load: { kind: 'loading' }, stack: [...state.stack, { target: action.target, selection: null }] };
    case 'pop-to':
      if (action.index < 0 || action.index >= state.stack.length - 1) return state;
      return { ...state, gen: state.gen + 1, load: { kind: 'loading' }, stack: state.stack.slice(0, action.index + 1) };
    case 'load-start':
      return { ...state, load: { kind: 'loading' }, stack: withTop(state, null) };
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
      return { ...state, stack: withTop(state, action.selection) };
    case 'path-only':
      return { ...state, pathOnly: action.value };
    case 'paused':
      return { ...state, paused: action.value };
  }
}
