import { createContext, useContext, type ReactNode } from 'react';

import type { VnextExportCategory } from '@vnext-forge-studio/app-contracts';

import type { ComponentRef } from './view-types';

/**
 * Optional "open in designer" wiring for the read-only inspectors. Absent by
 * default, so the monitoring app and the designer render no link buttons; the
 * instance monitor provides it.
 */
export interface ComponentLinkHandlers {
  /** File behind a reference: a path, `null` when it is not in this workspace, `undefined` while resolving. */
  resolveComponent?: (category: VnextExportCategory, ref: ComponentRef) => string | null | undefined;
  openComponent?: (category: VnextExportCategory, ref: ComponentRef) => void;
  /** Open a script by its `location` as written in the definition. */
  openScript?: (location: string) => void;
}

const ComponentLinkContext = createContext<ComponentLinkHandlers>({});

export function ComponentLinkProvider({ value, children }: { value: ComponentLinkHandlers; children: ReactNode }) {
  return <ComponentLinkContext.Provider value={value}>{children}</ComponentLinkContext.Provider>;
}

export function useComponentLinks(): ComponentLinkHandlers {
  return useContext(ComponentLinkContext);
}
