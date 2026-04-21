import { useSettingsStore, type ColorThemePreference } from '../store/useSettingsStore.js';

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
 * Store’daki güncel `colorTheme` ile dokümanı senkronlar. Shell `main.tsx` içinde
 * `createRoot` öncesi çağrılmalı; böylece ilk boyamada OS teması yansır (FOUC azalır).
 */
export function syncColorThemeFromSettingsStore(): void {
  applyColorThemeToDocument(useSettingsStore.getState().colorTheme);
}
