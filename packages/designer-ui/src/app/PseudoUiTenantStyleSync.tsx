import { useEffect } from 'react';

import {
  DEFAULT_PSEUDO_UI_TENANT_STYLE,
  useSettingsStore,
  type PseudoUiTenantStyleSettings,
} from '../store/useSettingsStore.js';

const LINK_ID = 'vnext-forge-pseudo-ui-tenant-style';

export function normalizePseudoUiTenantStyle(value: unknown): PseudoUiTenantStyleSettings | null {
  if (value == null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_PSEUDO_UI_TENANT_STYLE.enabled,
    sourceType: obj.sourceType === 'localFile' ? 'localFile' : 'url',
    value: typeof obj.value === 'string' ? obj.value : '',
  };
}

export function getPseudoUiTenantStyleHref(settings: PseudoUiTenantStyleSettings): string | null {
  return settings.enabled && settings.value.trim() ? settings.value.trim() : null;
}

export function setTenantStyleLink(href: string | null): void {
  const existing = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!href) {
    existing?.remove();
    return;
  }

  const link = existing ?? document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = href;

  if (!existing) {
    const forgeLayer = document.querySelector<HTMLLinkElement>('link[href*="pseudo-ui-layers"]');
    if (forgeLayer?.parentNode) {
      forgeLayer.parentNode.insertBefore(link, forgeLayer);
    } else {
      document.head.appendChild(link);
    }
  }
}

function readInjectedTenantStyle(): PseudoUiTenantStyleSettings | null {
  const config = (window as unknown as { __VNEXT_CONFIG__?: Record<string, unknown> }).__VNEXT_CONFIG__;
  return normalizePseudoUiTenantStyle(config?.pseudoUiTenantStyle);
}

export function PseudoUiTenantStyleSync() {
  const pseudoUiTenantStyle = useSettingsStore((s) => s.pseudoUiTenantStyle);
  const setPseudoUiTenantStyle = useSettingsStore((s) => s.setPseudoUiTenantStyle);

  useEffect(() => {
    const injected = readInjectedTenantStyle();
    if (injected) {
      setPseudoUiTenantStyle(injected);
    }

    function handleMessage(event: MessageEvent) {
      const data = event.data as Record<string, unknown> | undefined;
      if (data?.type !== 'host:canvas-settings-changed') return;
      const next = normalizePseudoUiTenantStyle(data.pseudoUiTenantStyle);
      if (next) setPseudoUiTenantStyle(next);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setPseudoUiTenantStyle]);

  useEffect(() => {
    const href =
      getPseudoUiTenantStyleHref(pseudoUiTenantStyle);
    setTenantStyleLink(href);
    return () => setTenantStyleLink(null);
  }, [pseudoUiTenantStyle.enabled, pseudoUiTenantStyle.value]);

  return null;
}
