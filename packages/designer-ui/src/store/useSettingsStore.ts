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

/**
 * Token-level tenant overrides for the pseudo-ui preview surface
 * (R10 — see `forgepseudouithemingspec.md` §4.1). Layered on top of
 * the Forge default theme stack inside the shadow root. Keys are
 * CSS custom-property names (`--p-*`, `--font-family`); the
 * sanitiser inside `parseTenantCss.ts` rejects anything else.
 *
 * `null` (default) means no tenant overrides — pseudo-ui uses the
 * Forge defaults only.
 */
export type PseudoUiTenantTokens = Record<string, string> | null;

interface SettingsState {
  colorTheme: ColorThemePreference;
  setColorTheme: (colorTheme: ColorThemePreference) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  pseudoUiTenantStyle: PseudoUiTenantStyleSettings;
  setPseudoUiTenantStyle: (patch: Partial<PseudoUiTenantStyleSettings>) => void;
  pseudoUiTenantTokens: PseudoUiTenantTokens;
  setPseudoUiTenantTokens: (tokens: PseudoUiTenantTokens) => void;
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

function normalizePseudoUiTenantTokens(value: unknown): PseudoUiTenantTokens {
  if (value == null || typeof value !== 'object') return null;
  const out: Record<string, string> = {};
  let any = false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string' || !v) continue;
    out[k] = v;
    any = true;
  }
  return any ? out : null;
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
      pseudoUiTenantTokens: null,
      setPseudoUiTenantTokens: (tokens) =>
        set({ pseudoUiTenantTokens: normalizePseudoUiTenantTokens(tokens) }),
    }),
    {
      name: SETTINGS_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        colorTheme: state.colorTheme,
        autoSaveEnabled: state.autoSaveEnabled,
        pseudoUiTenantStyle: state.pseudoUiTenantStyle,
        pseudoUiTenantTokens: state.pseudoUiTenantTokens,
      }),
      version: 3,
      migrate: (persisted, version) => {
        const next = {
          ...(persisted as Record<string, unknown>),
          pseudoUiTenantStyle: normalizePseudoUiTenantStyle(
            (persisted as Record<string, unknown>)?.pseudoUiTenantStyle,
          ),
          pseudoUiTenantTokens: normalizePseudoUiTenantTokens(
            (persisted as Record<string, unknown>)?.pseudoUiTenantTokens,
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
