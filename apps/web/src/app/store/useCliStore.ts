import { isFailure } from '@vnext-forge-studio/app-contracts';
import { create } from 'zustand';

import { checkCliAvailable, checkCliUpdate, updateCliGlobal } from '../../services/cli.service';

interface CliStore {
  available: boolean | null;
  version: string | null;
  checking: boolean;
  latestVersion: string | null;
  updateAvailable: boolean;
  updating: boolean;
  checkAvailability: () => Promise<void>;
  checkForUpdate: () => Promise<void>;
  runUpdate: () => Promise<void>;
}

export const useCliStore = create<CliStore>((set, get) => ({
  available: null,
  version: null,
  checking: false,
  latestVersion: null,
  updateAvailable: false,
  updating: false,
  checkAvailability: async () => {
    if (get().checking) return;
    set({ checking: true });
    try {
      const result = await checkCliAvailable();
      if (isFailure(result)) {
        set({ available: false, version: null, checking: false });
        return;
      }
      const { available, version } = result.data;
      set({
        available,
        version: version ?? null,
        checking: false,
      });
    } catch {
      set({ available: false, version: null, checking: false });
    }
  },
  checkForUpdate: async () => {
    try {
      const result = await checkCliUpdate();
      if (isFailure(result)) {
        set({ latestVersion: null, updateAvailable: false });
        return;
      }
      const { latest, updateAvailable } = result.data;
      set({
        latestVersion: latest,
        updateAvailable,
      });
    } catch {
      set({ latestVersion: null, updateAvailable: false });
    }
  },
  runUpdate: async () => {
    if (get().updating) return;
    set({ updating: true });
    try {
      const result = await updateCliGlobal();
      if (isFailure(result)) {
        return;
      }
      if (result.data.exitCode === 0) {
        await get().checkAvailability();
        await get().checkForUpdate();
      }
    } finally {
      set({ updating: false });
    }
  },
}));
