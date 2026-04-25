import { useEffect } from 'react';

import { applyColorThemeToDocument } from '../theme/documentTheme.js';
import { useSettingsStore } from '../store/useSettingsStore.js';

/**
 * Host shell’lerde `DesignerUiProvider` ile birlikte mount edilir: store’daki
 * `colorTheme` değişimini `document.documentElement` üzerine yansıtır ve
 * `system` modunda `prefers-color-scheme` değişimini dinler.
 */
export function DocumentThemeSync() {
  const colorTheme = useSettingsStore((s) => s.colorTheme);
  useEffect(() => {
    applyColorThemeToDocument(colorTheme);
    if (colorTheme !== 'system') {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSchemeChange = () => applyColorThemeToDocument('system');
    mq.addEventListener('change', onSchemeChange);
    return () => mq.removeEventListener('change', onSchemeChange);
  }, [colorTheme]);
  return null;
}
