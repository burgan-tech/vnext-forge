import { create } from 'zustand';

/**
 * Host-agnostic shell ayarları (web SPA, VS Code webview). Renk teması tercihi
 * `DocumentThemeSync` ile `<html data-theme>` ve `class="dark"` üzerine yansır.
 *
 * Varsayılan `system`: OS `prefers-color-scheme` ile açılışta doğru tema yüklenir.
 */
export type ColorThemePreference = 'light' | 'dark' | 'system';

interface SettingsState {
  colorTheme: ColorThemePreference;
  setColorTheme: (colorTheme: ColorThemePreference) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  colorTheme: 'system',
  setColorTheme: (colorTheme) => set({ colorTheme }),
}));
