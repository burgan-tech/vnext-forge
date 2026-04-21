import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type CodeEditorToolbarContextValue = {
  toolbar: ReactNode | null;
  setToolbar: (node: ReactNode | null) => void;
};

const CodeEditorToolbarContext = createContext<CodeEditorToolbarContextValue | null>(null);

export function CodeEditorToolbarProvider({ children }: { children: ReactNode }) {
  const [toolbar, setToolbarState] = useState<ReactNode | null>(null);
  const setToolbar = useCallback((node: ReactNode | null) => {
    setToolbarState(node);
  }, []);
  const value = useMemo(() => ({ toolbar, setToolbar }), [toolbar, setToolbar]);
  return (
    <CodeEditorToolbarContext.Provider value={value}>{children}</CodeEditorToolbarContext.Provider>
  );
}

export function useCodeEditorToolbar(): CodeEditorToolbarContextValue {
  const ctx = useContext(CodeEditorToolbarContext);
  if (!ctx) {
    return {
      toolbar: null,
      setToolbar: () => {},
    };
  }
  return ctx;
}
