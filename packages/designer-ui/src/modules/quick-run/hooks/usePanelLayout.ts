import { useCallback, useEffect, useRef, useState } from 'react';

import { clampSize, parseStoredLayout, resizeBy, type PanelLayoutState } from './panelLayout';

export type PanelDefaults = Record<string, { size: number; open: boolean; min: number; max: number }>;

function toState(defaults: PanelDefaults): PanelLayoutState {
  const state: PanelLayoutState = {};
  for (const [panel, d] of Object.entries(defaults)) state[panel] = { size: d.size, open: d.open };
  return state;
}

function readInitial(storageKey: string, defaults: PanelDefaults): PanelLayoutState {
  const base = toState(defaults);
  let raw: string | null = null;
  try {
    if (typeof window !== 'undefined') raw = window.localStorage.getItem(storageKey);
  } catch {
    raw = null;
  }
  const parsed = parseStoredLayout(raw, base);
  const out: PanelLayoutState = {};
  for (const [panel, v] of Object.entries(parsed)) {
    const d = defaults[panel];
    out[panel] = { ...v, size: clampSize(v.size, d.min, d.max) };
  }
  return out;
}

/** Persisted size/open state for resizable panels. Storage is optional; the UI works without it. */
export function usePanelLayout(storageKey: string, defaults: PanelDefaults) {
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [state, setState] = useState<PanelLayoutState>(() => readInitial(storageKey, defaults));

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // storage unavailable — layout simply is not remembered
    }
  }, [storageKey, state]);

  const size = useCallback((panel: string) => state[panel]?.size ?? 0, [state]);
  const isOpen = useCallback((panel: string) => state[panel]?.open ?? false, [state]);

  const resize = useCallback((panel: string, delta: number) => {
    const d = defaultsRef.current[panel];
    if (!d) return;
    setState((s) => resizeBy(s, panel, delta, { min: d.min, max: d.max }));
  }, []);

  const setOpen = useCallback((panel: string, open: boolean) => {
    setState((s) => (s[panel] ? { ...s, [panel]: { ...s[panel], open } } : s));
  }, []);

  const toggle = useCallback((panel: string) => {
    setState((s) => (s[panel] ? { ...s, [panel]: { ...s[panel], open: !s[panel].open } } : s));
  }, []);

  return { size, isOpen, resize, setOpen, toggle };
}
