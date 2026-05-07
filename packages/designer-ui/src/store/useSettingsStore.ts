import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * `localStorage` anahtarı — shell ilk boyaması için `documentTheme` ile aynı isim kullanılmalıdır.
 */
export const SETTINGS_PERSIST_KEY = 'vnext-forge-studio-settings';

/**
 * Host-agnostic shell ayarları (web SPA, VS Code webview). Renk teması tercihi
 * `DocumentThemeSync` ile `<html data-theme>` ve `class="dark"` üzerine yansır.
 *
 * Varsayılan `system`: OS `prefers-color-scheme` ile açılışta doğru tema yüklenir.
 * Tercih `localStorage` ile kalıcıdır; ileride başka alanlar `partialize` ile eklenebilir.
 */
export type ColorThemePreference = 'light' | 'dark' | 'system';

interface SettingsState {
  colorTheme: ColorThemePreference;
  setColorTheme: (colorTheme: ColorThemePreference) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      colorTheme: 'system',
      setColorTheme: (colorTheme) => set({ colorTheme }),
    }),
    {
      name: SETTINGS_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ colorTheme: state.colorTheme }),
      version: 0,
    },
  ),
);
