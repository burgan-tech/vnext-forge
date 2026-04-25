import { useEffect, useRef } from 'react';

import { registerGlobalSaveHandler } from '../lib/globalSaveShortcutRegistry.js';

/** Registers Cmd/Ctrl+S with the shared global save registry (single window listener). */
export function useRegisterGlobalSaveShortcut(handler: () => void | Promise<void>): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => registerGlobalSaveHandler(() => ref.current()), []);
}
