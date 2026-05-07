import { createContext, useContext, type ReactNode } from 'react';

export interface SubFlowNavigationContextValue {
  onOpenSubFlow: (processKey: string, processDomain: string) => void;
}

const SubFlowNavigationContext = createContext<SubFlowNavigationContextValue>({
  onOpenSubFlow: () => {},
});

interface SubFlowNavigationProviderProps {
  onOpenSubFlow: (processKey: string, processDomain: string) => void;
  children: ReactNode;
}

export function SubFlowNavigationProvider({
  onOpenSubFlow,
  children,
}: SubFlowNavigationProviderProps) {
  return (
    <SubFlowNavigationContext.Provider value={{ onOpenSubFlow }}>
      {children}
    </SubFlowNavigationContext.Provider>
  );
}

export function useSubFlowNavigation(): SubFlowNavigationContextValue {
  return useContext(SubFlowNavigationContext);
}
