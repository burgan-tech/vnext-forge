import { create } from 'zustand';
import type { SchemaCapabilities } from './SchemaCapabilities';
import { ALL_ENABLED } from './SchemaCapabilities';

interface SchemaCapabilitiesState {
  entries: Record<string, SchemaCapabilities>;
  set: (key: string, caps: SchemaCapabilities) => void;
  get: (key: string) => SchemaCapabilities;
  clear: () => void;
}

export function storeKey(type: string, version: string | undefined): string {
  return version ? `${type}:${version}` : `${type}:__bundled__`;
}

export const useSchemaCapabilitiesStore = create<SchemaCapabilitiesState>((set, get) => ({
  entries: {},
  set: (key, caps) =>
    set((state) => ({ entries: { ...state.entries, [key]: caps } })),
  get: (key) => get().entries[key] ?? ALL_ENABLED,
  clear: () => set({ entries: {} }),
}));
