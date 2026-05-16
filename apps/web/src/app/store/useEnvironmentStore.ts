import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useRuntimeStore } from '@vnext-forge-studio/designer-ui';

const PERSIST_KEY = 'vnext-forge-environments';

export const FALLBACK_RUNTIME_URL = 'http://localhost:4201';

const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:']);

export interface RuntimeEnvironment {
  id: string;
  name: string;
  baseUrl: string;
  dbName?: string;
}

interface EnvironmentPersistSlice {
  environments: RuntimeEnvironment[];
  activeEnvironmentId: string | null;
}

interface EnvironmentActions {
  addEnvironment: (name: string, baseUrl: string, dbName?: string) => void;
  updateEnvironment: (id: string, patch: { name?: string; baseUrl?: string }) => void;
  removeEnvironment: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  getActiveEnvironment: () => RuntimeEnvironment | null;
}

export type EnvironmentState = EnvironmentPersistSlice & EnvironmentActions;

function stripTrailingSlashes(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function validateRuntimeBaseUrl(url: string): string {
  const normalized = stripTrailingSlashes(url);
  try {
    const parsed = new URL(normalized);
    if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) {
      throw new Error('Only http and https URLs are allowed.');
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Only http')) throw e;
    const wrapped = new Error('Enter a valid http or https URL.');
    wrapped.cause = e;
    throw wrapped;
  }
  return normalized;
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      environments: [],
      activeEnvironmentId: null,

      getActiveEnvironment: () => {
        const { environments, activeEnvironmentId } = get();
        if (!activeEnvironmentId) return null;
        return environments.find((e) => e.id === activeEnvironmentId) ?? null;
      },

      addEnvironment: (name, baseUrl, dbName) => {
        const base = validateRuntimeBaseUrl(baseUrl);
        const trimmedName = name.trim();
        if (!trimmedName) throw new Error('Name is required.');

        set((state) => {
          const id = crypto.randomUUID();
          const env: RuntimeEnvironment = {
            id,
            name: trimmedName,
            baseUrl: base,
            ...(dbName ? { dbName: dbName.trim() } : {}),
          };
          const next: RuntimeEnvironment[] = [...state.environments, env];
          const activeEnvironmentId = state.activeEnvironmentId ?? id;
          return { environments: next, activeEnvironmentId };
        });
      },

      updateEnvironment: (id, patch) => {
        if (patch.name !== undefined && !patch.name.trim()) {
          throw new Error('Name is required.');
        }
        let nextBaseUrl: string | undefined;
        if (patch.baseUrl !== undefined) {
          nextBaseUrl = validateRuntimeBaseUrl(patch.baseUrl);
        }
        const nextName = patch.name !== undefined ? patch.name.trim() : undefined;
        set((state) => ({
          environments: state.environments.map((env) =>
            env.id !== id
              ? env
              : {
                  ...env,
                  ...(nextName !== undefined ? { name: nextName } : {}),
                  ...(nextBaseUrl !== undefined ? { baseUrl: nextBaseUrl } : {}),
                },
          ),
        }));
      },

      removeEnvironment: (id) => {
        set((state) => {
          const next = state.environments.filter((e) => e.id !== id);
          let activeEnvironmentId = state.activeEnvironmentId;
          if (activeEnvironmentId === id) {
            activeEnvironmentId = next[0]?.id ?? null;
          }
          return { environments: next, activeEnvironmentId };
        });
      },

      setActiveEnvironment: (activeEnvironmentId) => {
        set((state) => {
          if (activeEnvironmentId == null) return { activeEnvironmentId: null };
          if (!state.environments.some((e) => e.id === activeEnvironmentId)) {
            return {};
          }
          return { activeEnvironmentId };
        });
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): EnvironmentPersistSlice => ({
        environments: state.environments,
        activeEnvironmentId: state.activeEnvironmentId,
      }),
      version: 2,
      migrate: (persisted) => unwrapPersistedSlice(persisted, migrateEnvironmentsPersisted),
    },
  ),
);

/** Zustand may pass the partialize slice or a wrapper; normalize before migrate. */
function unwrapPersistedSlice<T>(persisted: unknown, migrate: (inner: unknown) => T): T {
  if (persisted != null && typeof persisted === 'object' && 'state' in persisted) {
    const s = (persisted as { state?: unknown }).state;
    return migrate(s);
  }
  return migrate(persisted);
}

function migrateEnvironmentsPersisted(persisted: unknown): EnvironmentPersistSlice {
  const defaults: EnvironmentPersistSlice = { environments: [], activeEnvironmentId: null };
  if (persisted == null || typeof persisted !== 'object') return defaults;
  const obj = persisted as Record<string, unknown>;

  const environments: RuntimeEnvironment[] = [];
  if (Array.isArray(obj.environments)) {
    for (const item of obj.environments) {
      if (
        item != null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        typeof (item as Record<string, unknown>).baseUrl === 'string'
      ) {
        const rawUrl = stripTrailingSlashes((item as Record<string, unknown>).baseUrl as string);
        try {
          validateRuntimeBaseUrl(rawUrl);
        } catch {
          continue;
        }
        const rec = item as Record<string, unknown>;
        environments.push({
          id: rec.id as string,
          name: rec.name as string,
          baseUrl: rawUrl,
          ...(typeof rec.dbName === 'string' && rec.dbName.length > 0 ? { dbName: rec.dbName } : {}),
        });
      }
    }
  }

  let activeEnvironmentId: string | null = null;
  if (
    typeof obj.activeEnvironmentId === 'string' &&
    environments.some((e) => e.id === obj.activeEnvironmentId)
  ) {
    activeEnvironmentId = obj.activeEnvironmentId;
  }

  return { environments, activeEnvironmentId };
}

export async function syncRuntimeUrlFromEnvironmentPersist(): Promise<void> {
  await useEnvironmentStore.persist.rehydrate();
  const env = useEnvironmentStore.getState().getActiveEnvironment();
  useRuntimeStore.getState().setRuntimeUrl(env?.baseUrl ?? FALLBACK_RUNTIME_URL);
}
