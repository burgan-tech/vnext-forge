import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface ScriptTaskChromeContextValue {
  onOpenScriptFileInHost?: (absolutePath: string) => void;
  /**
   * Directory the script's `location` (e.g. `./onEntry.csx`) is relative
   * to. When provided alongside `onOpenScriptFileInHost`, callers can
   * resolve a B64-encoded script's file path and open it directly in
   * the host editor (native VS Code tab in the extension shell, or a
   * full-page Monaco route in the web shell) — bypassing the in-app
   * bottom drawer. Falls back to the bottom drawer when this is
   * missing or when the script is inline-stored (`NAT` encoding).
   */
  scriptDirectoryPath?: string;
}

const ScriptTaskChromeContext = createContext<ScriptTaskChromeContextValue | null>(null);

export function ScriptTaskChromeProvider({
  children,
  onOpenScriptFileInHost,
  scriptDirectoryPath,
}: {
  children: ReactNode;
  onOpenScriptFileInHost?: (absolutePath: string) => void;
  scriptDirectoryPath?: string;
}) {
  const value = useMemo(
    () => ({ onOpenScriptFileInHost, scriptDirectoryPath }),
    [onOpenScriptFileInHost, scriptDirectoryPath],
  );
  return <ScriptTaskChromeContext.Provider value={value}>{children}</ScriptTaskChromeContext.Provider>;
}

export function useScriptTaskChrome(): ScriptTaskChromeContextValue | null {
  return useContext(ScriptTaskChromeContext);
}

export { ScriptTaskChromeContext };
