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
  /**
   * R20.3: extra locales the user has added through the inline picker
   * so they stay visible as chips even when not currently active.
   * TR/EN are always shown (as built-in presets); anything else lands
   * here.
   */
  pseudoUiCustomLangs: string[];
  addPseudoUiCustomLang: (lang: string) => void;
  removePseudoUiCustomLang: (lang: string) => void;
  /**
   * R24 DEV TOGGLE — when `true`, the QuickRunner pseudo-ui delegate
   * routes every SDK `onLog` callback (debug / info / warn / error)
   * straight to `console.log` with a `[pseudo-ui]` prefix so a
   * developer can read the raw stream during debugging. The
   * structured Forge logger still receives every entry underneath.
   *
   * **MUST remain `false` in committed code.** There is intentionally
   * no settings-UI toggle: flip the default here while debugging,
   * then revert before commit. Persisted across reloads so the flag
   * survives webview restarts in a debugging session.
   */
  pseudoUiVerboseLogs: boolean;
  setPseudoUiVerboseLogs: (enabled: boolean) => void;
}

/** Built-in language chips that are always offered by the picker. */
export const BUILTIN_PSEUDO_UI_LANGS = ['tr', 'en'] as const;

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

function normalizePseudoUiCustomLangs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const builtIn = new Set<string>(BUILTIN_PSEUDO_UI_LANGS);
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;
    if (builtIn.has(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
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
      setPseudoUiLang: (lang) => {
        const normalized = normalizePseudoUiLang(lang);
        set((state) => {
          // If the active language isn't a built-in chip and the user
          // hasn't already added it as a custom chip, register it so
          // the picker keeps showing the locale rather than silently
          // hiding it on the next mount (e.g. legacy persisted state
          // that pre-dates the customLangs list).
          const isBuiltIn = (BUILTIN_PSEUDO_UI_LANGS as readonly string[]).includes(normalized);
          const alreadyTracked = state.pseudoUiCustomLangs.includes(normalized);
          if (!isBuiltIn && !alreadyTracked) {
            return {
              pseudoUiLang: normalized,
              pseudoUiCustomLangs: normalizePseudoUiCustomLangs([
                ...state.pseudoUiCustomLangs,
                normalized,
              ]),
            };
          }
          return { pseudoUiLang: normalized };
        });
      },
      pseudoUiCustomLangs: [],
      addPseudoUiCustomLang: (lang) =>
        set((state) => ({
          pseudoUiCustomLangs: normalizePseudoUiCustomLangs([...state.pseudoUiCustomLangs, lang]),
        })),
      removePseudoUiCustomLang: (lang) =>
        set((state) => ({
          pseudoUiCustomLangs: state.pseudoUiCustomLangs.filter((l) => l !== lang),
          // If we just removed the currently-active locale, fall back to
          // the default so multi-lang views never end up rendering for a
          // language the user explicitly discarded.
          pseudoUiLang: state.pseudoUiLang === lang ? DEFAULT_PSEUDO_UI_LANG : state.pseudoUiLang,
        })),
      // R24 DEV TOGGLE — see field doc above. MUST remain `false` in
      // committed code.
      pseudoUiVerboseLogs: false,
      setPseudoUiVerboseLogs: (pseudoUiVerboseLogs) => set({ pseudoUiVerboseLogs }),
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
        pseudoUiCustomLangs: state.pseudoUiCustomLangs,
        pseudoUiVerboseLogs: state.pseudoUiVerboseLogs,
      }),
      version: 6,
      migrate: (persisted, version) => {
        const persistedObj = (persisted as Record<string, unknown>) ?? {};
        const next = {
          ...persistedObj,
          pseudoUiTenantStyle: normalizePseudoUiTenantStyle(persistedObj.pseudoUiTenantStyle),
          pseudoUiTenantTokens: normalizePseudoUiTenantTokens(persistedObj.pseudoUiTenantTokens),
          pseudoUiLang: normalizePseudoUiLang(persistedObj.pseudoUiLang),
          pseudoUiCustomLangs: normalizePseudoUiCustomLangs(persistedObj.pseudoUiCustomLangs),
          // R24 DEV TOGGLE — default false on every migration path so
          // an old persisted state never resurrects the flag on its
          // own. Anyone debugging flips the default at field-init
          // time, not via persisted localStorage.
          pseudoUiVerboseLogs:
            typeof persistedObj.pseudoUiVerboseLogs === 'boolean'
              ? persistedObj.pseudoUiVerboseLogs
              : false,
        };
        if (version === 0) {
          return { ...next, autoSaveEnabled: false };
        }
        return next as unknown as SettingsState;
      },
    },
  ),
);
