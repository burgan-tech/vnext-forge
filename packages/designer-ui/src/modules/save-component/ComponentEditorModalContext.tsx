import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ComponentEditorDialog } from './components/ComponentEditorDialog.js';
import type { ComponentEditorTarget } from './componentEditorModalTypes.js';

export type { AtomicSavedInfo, ComponentEditorTarget } from './componentEditorModalTypes.js';

type ModalApi = {
  openModal: (target: ComponentEditorTarget) => void;
  closeModal: () => void;
};

const ModalApiContext = createContext<ModalApi | null>(null);
const ModalStateContext = createContext<{
  open: boolean;
  target: ComponentEditorTarget | null;
} | null>(null);

export interface ComponentEditorModalProviderProps {
  children: ReactNode;
  /** For script tasks: open the .csx in the host full editor (e.g. Monaco tab). */
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}

/** Mount under the Flow Editor body; renders `<ComponentEditorDialog />` for atomic editors. */
export function ComponentEditorModalProvider({
  children,
  onOpenScriptFileInHost,
}: ComponentEditorModalProviderProps) {
  const [target, setTarget] = useState<ComponentEditorTarget | null>(null);

  const openModal = useCallback((next: ComponentEditorTarget) => {
    setTarget(next);
  }, []);

  const closeModal = useCallback(() => {
    setTarget(null);
  }, []);

  const api = useMemo<ModalApi>(
    () => ({ openModal, closeModal }),
    [openModal, closeModal],
  );

  const state = useMemo(
    () => ({ open: target !== null, target }),
    [target],
  );

  return (
    <ModalApiContext.Provider value={api}>
      <ModalStateContext.Provider value={state}>
        {children}
        <ComponentEditorDialog
          open={state.open}
          target={state.target}
          onCloseRequest={() => setTarget(null)}
          onOpenScriptFileInHost={onOpenScriptFileInHost}
        />
      </ModalStateContext.Provider>
    </ModalApiContext.Provider>
  );
}

export function useOpenComponentEditorModal(): (target: ComponentEditorTarget) => void {
  const ctx = useContext(ModalApiContext);
  return useCallback(
    (target: ComponentEditorTarget) => {
      if (!ctx) {
        if (
          typeof import.meta !== 'undefined' &&
          (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
        ) {
          // Often indicates duplicate @vnext-forge-studio/designer-ui copies (stale context).
          console.error(
            'useOpenComponentEditorModal: no ComponentEditorModalProvider; openModal is a no-op.',
          );
        }
        return;
      }
      ctx.openModal(target);
    },
    [ctx],
  );
}

export function useComponentEditorModalState() {
  const ctx = useContext(ModalStateContext);
  if (!ctx) {
    throw new Error('useComponentEditorModalState must be used within ComponentEditorModalProvider');
  }
  return ctx;
}
