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

export type PseudoUiTenantStyleSource = 'url' | 'localFile';

export interface PseudoUiTenantStyleSettings {
  enabled: boolean;
  sourceType: PseudoUiTenantStyleSource;
  value: string;
}

export const DEFAULT_PSEUDO_UI_TENANT_STYLE: PseudoUiTenantStyleSettings = {
  enabled: false,
  sourceType: 'url',
  value: '',
};

interface SettingsState {
  colorTheme: ColorThemePreference;
  setColorTheme: (colorTheme: ColorThemePreference) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  pseudoUiTenantStyle: PseudoUiTenantStyleSettings;
  setPseudoUiTenantStyle: (patch: Partial<PseudoUiTenantStyleSettings>) => void;
}

function normalizePseudoUiTenantStyle(value: unknown): PseudoUiTenantStyleSettings {
  if (value == null || typeof value !== 'object') {
    return { ...DEFAULT_PSEUDO_UI_TENANT_STYLE };
  }
  const obj = value as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_PSEUDO_UI_TENANT_STYLE.enabled,
    sourceType: obj.sourceType === 'localFile' ? 'localFile' : 'url',
    value: typeof obj.value === 'string' ? obj.value : '',
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      colorTheme: 'system',
      setColorTheme: (colorTheme) => set({ colorTheme }),
      autoSaveEnabled: false,
      setAutoSaveEnabled: (autoSaveEnabled) => set({ autoSaveEnabled }),
      pseudoUiTenantStyle: { ...DEFAULT_PSEUDO_UI_TENANT_STYLE },
      setPseudoUiTenantStyle: (patch) =>
        set((state) => ({
          pseudoUiTenantStyle: normalizePseudoUiTenantStyle({
            ...state.pseudoUiTenantStyle,
            ...patch,
          }),
        })),
    }),
    {
      name: SETTINGS_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        colorTheme: state.colorTheme,
        autoSaveEnabled: state.autoSaveEnabled,
        pseudoUiTenantStyle: state.pseudoUiTenantStyle,
      }),
      version: 2,
      migrate: (persisted, version) => {
        const next = {
          ...(persisted as Record<string, unknown>),
          pseudoUiTenantStyle: normalizePseudoUiTenantStyle(
            (persisted as Record<string, unknown>)?.pseudoUiTenantStyle,
          ),
        };
        if (version === 0) {
          return { ...next, autoSaveEnabled: false };
        }
        return next as unknown as SettingsState;
      },
    },
  ),
);
