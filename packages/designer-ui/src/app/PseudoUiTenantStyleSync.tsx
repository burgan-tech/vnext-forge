import { useEffect } from 'react';

import {
  DEFAULT_PSEUDO_UI_TENANT_STYLE,
  useSettingsStore,
  type PseudoUiTenantStyleSettings,
} from '../store/useSettingsStore.js';

const LINK_ID = 'vnext-forge-pseudo-ui-tenant-style';
const ROOT_ATTR = 'data-vnext-tenant-style';

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

/**
 * Append (or refresh / remove) the tenant CSS `<link>` inside an
 * arbitrary root — typically a `ShadowRoot`. R9 introduces this so
 * pseudo-ui previews mounted inside a shadow tree pick up tenant
 * styling; light-DOM `<link>` declarations do not cross the shadow
 * boundary.
 *
 * The link is marked with `data-vnext-tenant-style` so repeat calls
 * locate and replace any previous instance (idempotent). Passing
 * `null` removes the link entirely.
 *
 * Same-origin shadow roots inherit the parent's network permissions,
 * so the browser fetches `href` exactly as it would for a parent-doc
 * `<link>`. CSP `style-src` already includes the tenant origin via
 * `getTenantStyleCspSource()` in the panel HTML builders.
 */
export function appendTenantStyleLinkToRoot(
  root: ShadowRoot | Document,
  href: string | null,
): void {
  const existing = root.querySelector<HTMLLinkElement>(`link[${ROOT_ATTR}]`);
  if (!href) {
    existing?.remove();
    return;
  }
  if (existing) {
    if (existing.href !== href) existing.href = href;
    return;
  }
  const ownerDoc = root instanceof Document ? root : root.ownerDocument ?? document;
  const link = ownerDoc.createElement('link');
  link.setAttribute(ROOT_ATTR, '');
  link.rel = 'stylesheet';
  link.href = href;
  root.appendChild(link);
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
