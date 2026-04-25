import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface ScriptTaskChromeContextValue {
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}

const ScriptTaskChromeContext = createContext<ScriptTaskChromeContextValue | null>(null);

export function ScriptTaskChromeProvider({
  children,
  onOpenScriptFileInHost,
}: {
  children: ReactNode;
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}) {
  const value = useMemo(() => ({ onOpenScriptFileInHost }), [onOpenScriptFileInHost]);
  return <ScriptTaskChromeContext.Provider value={value}>{children}</ScriptTaskChromeContext.Provider>;
}

export function useScriptTaskChrome(): ScriptTaskChromeContextValue | null {
  return useContext(ScriptTaskChromeContext);
}

export { ScriptTaskChromeContext };
