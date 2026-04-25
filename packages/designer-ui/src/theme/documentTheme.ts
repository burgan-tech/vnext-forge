import {
  SETTINGS_PERSIST_KEY,
  useSettingsStore,
  type ColorThemePreference,
} from '../store/useSettingsStore.js';

/**
 * Tercihi (light / dark / system) gerçek görünüme çevirir.
 */
export function resolveColorTheme(preference: ColorThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Shell kökünde (`document.documentElement`) `data-theme` ve Tailwind `dark`
 * sınıfını ayarlar. Koyu token’lar `styles.css` içindeki `html.dark` bloğunda.
 */
export function applyColorThemeToDocument(preference: ColorThemePreference): void {
  const resolved = resolveColorTheme(preference);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
}

/**
 * Zustand persist henüz rehydrate olmadan önce `localStorage` içindeki kaydı okur
 * (persist JSON biçimi: `{ state: { colorTheme }, version }`).
 */
function readPersistedColorThemeFromStorage(): ColorThemePreference | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(SETTINGS_PERSIST_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { state?: { colorTheme?: unknown } };
    const t = parsed.state?.colorTheme;
    if (t === 'light' || t === 'dark' || t === 'system') {
      return t;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Store / kalıcı ayarlarla dokümanı senkronlar. Shell `main.tsx` içinde
 * `createRoot` öncesi çağrılmalı; önce `localStorage` (persist), yoksa store varsayılanı.
 */
export function syncColorThemeFromSettingsStore(): void {
  const persisted = readPersistedColorThemeFromStorage();
  const preference = persisted ?? useSettingsStore.getState().colorTheme;
  applyColorThemeToDocument(preference);
}
