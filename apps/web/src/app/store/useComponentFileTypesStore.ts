import { create } from 'zustand';

export type VnextComponentType =
  | 'workflow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension';

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
 * Record<normalizedRelativePath, VnextComponentType> kullanılır.
 * Map yerine plain object: Zustand selector'lar `Object.is` ile karşılaştırır,
 * tek bir key değiştiğinde bile Map referansı değişir ve TÜM subscriber'lar
 * re-render olur. Bu store'da `version` counter tutarak selector'ların
 * sadece ilgili path'in değeri değiştiğinde re-render olmasını sağlıyoruz.
 */
interface ComponentFileTypesState {
  /** Monoton artan sürüm numarası; her mutasyonda artar, selector invalidation'ı tetikler. */
  version: number;
  /** path -> component type lookup tablosu */
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
 * Belirli bir path için component type dönen selector.
 * Zustand `Object.is` ile karşılaştırır: dönen değer primitive (string | undefined)
 * olduğundan, aynı path'in tipi değişmedikçe component re-render OLMAZ.
 */
export function selectComponentFileType(relativePath: string) {
  const normalized = normalizePath(relativePath);
  return (state: ComponentFileTypesState): VnextComponentType | undefined =>
    state.fileTypes[normalized];
}

export { FLOW_TO_COMPONENT_TYPE, flowToComponentType };
