import { create } from 'zustand';

import type { VnextComponentType } from '@vnext-forge-studio/designer-ui';

export type { VnextComponentType };

const FLOW_TO_COMPONENT_TYPE: Record<string, VnextComponentType> = {
  'sys-flows': 'workflow',
  'sys-tasks': 'task',
  'sys-schemas': 'schema',
  'sys-views': 'view',
  'sys-functions': 'function',
  'sys-extensions': 'extension',
};

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function flowToComponentType(flow: string): VnextComponentType | null {
  return FLOW_TO_COMPONENT_TYPE[flow] ?? null;
}

/**
 * Web-only lookup of `relativePath -> VnextComponentType`, used by the web
 * FileTree to render the right component icon and by the web code editor to
 * refresh the icon after a save. The VS Code extension webview does not
 * render the custom file tree — VS Code's Explorer replaces it — so this
 * store is not needed there.
 *
 * Record<normalizedRelativePath, VnextComponentType>; a monotonically
 * increasing `version` counter is used so selectors only re-render when the
 * specific path they care about changes.
 */
interface ComponentFileTypesState {
  version: number;
  fileTypes: Record<string, VnextComponentType>;
  setFileTypes: (types: Record<string, string>) => void;
  setFileType: (path: string, type: VnextComponentType | null) => void;
  clearFileTypes: () => void;
}

export const useComponentFileTypesStore = create<ComponentFileTypesState>((set, get) => ({
  version: 0,
  fileTypes: {},

  setFileTypes: (types) => {
    const next: Record<string, VnextComponentType> = {};
    for (const [filePath, flow] of Object.entries(types)) {
      const componentType = flowToComponentType(flow);
      if (componentType) {
        next[normalizePath(filePath)] = componentType;
      }
    }
    set({ fileTypes: next, version: get().version + 1 });
  },

  setFileType: (filePath, type) => {
    const normalized = normalizePath(filePath);
    const current = get().fileTypes[normalized];

    if (type && current === type) return;
    if (!type && !current) return;

    set((state) => {
      const next = { ...state.fileTypes };
      if (type) {
        next[normalized] = type;
      } else {
        delete next[normalized];
      }
      return { fileTypes: next, version: state.version + 1 };
    });
  },

  clearFileTypes: () => {
    if (Object.keys(get().fileTypes).length === 0) return;
    set({ fileTypes: {}, version: get().version + 1 });
  },
}));

/**
 * Component-type selector for a specific path. Returns a primitive
 * (string | undefined) so Zustand's `Object.is` comparison prevents
 * re-renders when unrelated paths change.
 */
export function selectComponentFileType(relativePath: string) {
  const normalized = normalizePath(relativePath);
  return (state: ComponentFileTypesState): VnextComponentType | undefined =>
    state.fileTypes[normalized];
}

export { FLOW_TO_COMPONENT_TYPE, flowToComponentType };
