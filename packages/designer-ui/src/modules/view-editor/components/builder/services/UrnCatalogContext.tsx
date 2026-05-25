import { createContext, useContext, type ReactNode } from 'react';

import { EMPTY_URN_CATALOG, type ForgeUrnCatalog } from './forgeUrnCatalog';

/**
 * Provides the workspace URN action catalog (workflow transitions +
 * BFF functions) to the Builder's Inspector. ActionEditor reads this
 * via `useUrnCatalog` so the picker can render real, in-project
 * options without prop-drilling through PropertySchemaForm.
 *
 * Wrapped at the PseudoUiBuilder shell layer; defaults to an empty
 * catalog when no provider is mounted (legacy callers / tests).
 */
const UrnCatalogContext = createContext<ForgeUrnCatalog>(EMPTY_URN_CATALOG);

export function UrnCatalogProvider({
  catalog,
  children,
}: {
  catalog: ForgeUrnCatalog;
  children: ReactNode;
}) {
  return <UrnCatalogContext.Provider value={catalog}>{children}</UrnCatalogContext.Provider>;
}

export function useUrnCatalog(): ForgeUrnCatalog {
  return useContext(UrnCatalogContext);
}
