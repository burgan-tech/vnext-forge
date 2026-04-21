import { useSyncExternalStore } from 'react';

import { resolveColorTheme } from '../theme/documentTheme.js';
import { useSettingsStore } from '../store/useSettingsStore.js';

function subscribe(onChange: () => void) {
  const unsubStore = useSettingsStore.subscribe(onChange);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => {
    unsubStore();
    mq.removeEventListener('change', onChange);
  };
}

function getSnapshot(): 'light' | 'dark' {
  return resolveColorTheme(useSettingsStore.getState().colorTheme);
}

function getServerSnapshot(): 'light' | 'dark' {
  return 'light';
}

/**
 * `colorTheme` tercihi + (system iken) OS ile çözümlenen mod.
 */
export function useResolvedColorTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
