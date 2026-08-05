import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ToolHeadersState {
  /** Forge-wide headers, shared by the workflow runner and the function runner. */
  headers: Record<string, string>;
  setHeaders: (headers: Record<string, string>) => void;
}

/**
 * Lives in designer-ui rather than a host app because both shells read it and
 * `designer-ui` may not import from `apps/*`. Each host populates it at
 * bootstrap: the extension from `window.__VNEXT_CONFIG__` (designer webview)
 * or the `quickrun:context` message (Quick Run webview), the web shell from
 * its own persisted copy (nothing to fetch — this store rehydrates itself).
 */
export const useToolHeadersStore = create<ToolHeadersState>()(
  persist((set) => ({ headers: {}, setHeaders: (headers) => set({ headers }) }), {
    name: 'vnext-forge-tool-headers',
  }),
);
