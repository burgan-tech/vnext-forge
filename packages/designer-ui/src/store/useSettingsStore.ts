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

/**
 * Pseudo-ui render language (R20). Drives `<PseudoView lang>` so
 * multi-lang `textContent` objects resolve to the right locale.
 *
 * Free-form string because vNext views may declare any ISO locale
 * (`tr`, `en`, `ar`, `de`, …). When the requested lang has no
 * matching key on a `MultiLangText` object the SDK falls back to
 * `en` → `tr` → first value → empty (see SDK `resolveMultiLang`).
 *
 * Default `'tr'` reflects the platform's primary banking locale —
 * extension users get Turkish out of the box; web shell users can
 * override from the sidebar.
 */
export const DEFAULT_PSEUDO_UI_LANG = 'tr';

interface SettingsState {
  colorTheme: ColorThemePreference;
  setColorTheme: (colorTheme: ColorThemePreference) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  pseudoUiTenantStyle: PseudoUiTenantStyleSettings;
  setPseudoUiTenantStyle: (patch: Partial<PseudoUiTenantStyleSettings>) => void;
  pseudoUiTenantTokens: PseudoUiTenantTokens;
  setPseudoUiTenantTokens: (tokens: PseudoUiTenantTokens) => void;
  pseudoUiLang: string;
  setPseudoUiLang: (lang: string) => void;
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

function normalizePseudoUiLang(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_PSEUDO_UI_LANG;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PSEUDO_UI_LANG;
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
      pseudoUiLang: DEFAULT_PSEUDO_UI_LANG,
      setPseudoUiLang: (lang) => set({ pseudoUiLang: normalizePseudoUiLang(lang) }),
    }),
    {
      name: SETTINGS_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        colorTheme: state.colorTheme,
        autoSaveEnabled: state.autoSaveEnabled,
        pseudoUiTenantStyle: state.pseudoUiTenantStyle,
        pseudoUiTenantTokens: state.pseudoUiTenantTokens,
        pseudoUiLang: state.pseudoUiLang,
      }),
      version: 4,
      migrate: (persisted, version) => {
        const persistedObj = (persisted as Record<string, unknown>) ?? {};
        const next = {
          ...persistedObj,
          pseudoUiTenantStyle: normalizePseudoUiTenantStyle(persistedObj.pseudoUiTenantStyle),
          pseudoUiTenantTokens: normalizePseudoUiTenantTokens(persistedObj.pseudoUiTenantTokens),
          pseudoUiLang: normalizePseudoUiLang(persistedObj.pseudoUiLang),
        };
        if (version === 0) {
          return { ...next, autoSaveEnabled: false };
        }
        return next as unknown as SettingsState;
      },
    },
  ),
);
