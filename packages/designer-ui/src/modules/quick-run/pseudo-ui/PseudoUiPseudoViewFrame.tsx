/**
 * Shadow-DOM-isolated mount of pseudo-ui's `<PseudoView>` using the
 * SDK's `renderRoot` API and the R10 three-layer theme stack.
 *
 * History:
 *   - R6: iframe srcdoc (blocked by VS Code webview SW).
 *   - R7: shadow DOM with manual SDK CSS inline.
 *   - R8: SDK `renderRoot` + `adoptStylesIntoRoot`.
 *   - R9: stripped Forge VS Code theme bridge, locked to Lara light,
 *     tenant CSS via `<link>` in shadow.
 *   - R10 (this file): adopts `forgepseudouithemingspec.md` —
 *     L1 base MDC PrimeReact theme (light or dark, mirrored from
 *     parent `html.dark`), L2 Forge default token overrides, L3
 *     tenant token override (validated, `:host { --p-*: ... }`),
 *     L4 SDK `pseudo-ui-react.css` (auto-adopted by SDK). Atomic
 *     `adoptedStyleSheets` swap on theme / tenant change.
 *
 * AppTheme resolution: today we mirror parent `html.dark`. The
 * `useSettingsStore.colorTheme` setting (`'light' | 'dark' | 'system'`)
 * already drives that class on `<html>`; we just read the resulting
 * computed state. A future iteration may wire VS Code's
 * `onDidChangeActiveColorTheme` into the same store as a "system"
 * source, but the consumer-side hook here stays the same.
 */
import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useStore } from 'zustand';
import type { DataSchema, PseudoViewDelegate, ViewDefinition } from '@burgantech/pseudo-ui';
import { PseudoView } from '@burgantech/pseudo-ui/react';
import type { DesignerClassNames, DesignerMode } from '@burgantech/pseudo-ui/react';

import { useSettingsStore } from '../../../store/useSettingsStore';
import { syncThemeLayers } from './theme/buildSheets';
import type { AppTheme } from './theme/forgeDefaults';

// Side-effect imports: register PrimeIcons + Material Icons
// `@font-face` declarations in the *parent* document. CSS scoping
// spec: a shadow tree inherits @font-face from its outer document,
// so `.pi-*` and `.material-icons` class rules adopted into the
// shadow root resolve to these fonts without duplicating
// @font-face inside.
import 'primeicons/primeicons.css';
import 'material-icons/iconfont/material-icons.css';

// Icon class rules — these define `font-family` and ligature
// behaviour for the icon classes. The fonts themselves come from
// the parent-doc side-effect imports above; the class rules need to
// live in the shadow root scope so `.pi-info` etc. take effect
// inside the SDK render tree.
import primeIconsCss from 'primeicons/primeicons.css?raw';
import materialIconsCss from 'material-icons/iconfont/material-icons.css?raw';

const ICON_CSS_TEXT = `${primeIconsCss}\n${materialIconsCss}`;
let iconSheetSingleton: CSSStyleSheet | null = null;
function getIconSheet(): CSSStyleSheet {
  if (iconSheetSingleton) return iconSheetSingleton;
  const s = new CSSStyleSheet();
  s.replaceSync(ICON_CSS_TEXT);
  iconSheetSingleton = s;
  return iconSheetSingleton;
}

function readAppTheme(): AppTheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export interface PseudoUiPseudoViewFrameProps {
  schema: DataSchema;
  view: ViewDefinition;
  formData: Record<string, unknown>;
  instanceData?: Record<string, unknown>;
  lang: string;
  delegate: PseudoViewDelegate;
  onFormChange: (next: Record<string, unknown>) => void;
  /**
   * SDK designer mode. Boolean form is the legacy R5 toggle; the
   * v0.1.5+ enum (`'off' | 'preview' | 'edit'`) is forwarded
   * unchanged. `'edit'` activates the full canvas chrome (outline,
   * delete button, HTML5 drag-drop).
   */
  designer: boolean | DesignerMode;
  /** JSON Pointer of the currently-selected node (edit mode only). */
  selectedNodePath?: string;
  /** Override the SDK's designer chrome CSS class names. */
  designerClassNames?: DesignerClassNames;
  /** When true, host stretches to fill its parent. */
  fillHeight: boolean;
}

export function PseudoUiPseudoViewFrame(props: PseudoUiPseudoViewFrameProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const rootRef = useRef<Root | null>(null);
  // R23.1: keep the inside-shadow mount element around so the render
  // effect can route PrimeReact overlay portals (Dropdown panel,
  // Calendar, Tooltip…) here. Without this, SDK PseudoView's default
  // `appendTo: renderRoot.host` lands portals in the *parent* DOM
  // while the structural CSS (`styleContainer: shadow`) lives inside
  // the shadow root. The portal renders but with zero matching
  // rules — panel ends up invisible / zero-sized, even though the
  // dropdown's selected-value display works (that's painted inside
  // the shadow tree by PrimeReact's `optionLabel` lookup).
  const mountElRef = useRef<HTMLDivElement | null>(null);
  // R23.3: dedicated overlay-host sibling — see the mount effect for
  // the reasoning. PrimeReact positions overlay panels with
  // viewport-relative coordinates, so their `appendTo` target needs
  // to sit at viewport (0,0); otherwise the panel ends up offset by
  // the SDK mount element's own position. Hosting overlays in a
  // separate fixed-origin element decouples panel positioning from
  // wherever the SDK tree happens to live on screen.
  const overlayHostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [appTheme, setAppTheme] = useState<AppTheme>(readAppTheme);

  // Tenant tokens are surfaced via the settings store. The classic
  // URL/local-file tenant CSS path (R9) stays in light DOM via
  // `PseudoUiTenantStyleSync`; this hook only consumes the
  // structured token-map form spec'd in §4.1. When non-null, it
  // overlays Layer 3 of the theme stack inside the shadow root.
  const tenantTokens = useStore(useSettingsStore, (s) => s.pseudoUiTenantTokens);

  // Mount once: attach shadow, prime icon sheet, mount React root.
  // Theme layers are applied by a separate effect so theme/tenant
  // changes don't re-create the React tree.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    shadowRef.current = shadow;

    // Seed adoptedStyleSheets with the icon sheet (shared singleton).
    // The next effect will replace this with the full layered stack
    // and re-include the icon sheet implicitly via the foreign-sheet
    // preserve path in syncThemeLayers — but the sheet has to be
    // present before the first sync so its rules are in the cascade.
    shadow.adoptedStyleSheets = [getIconSheet()];

    let mountEl = shadow.querySelector<HTMLDivElement>('[data-pseudo-mount]');
    if (!mountEl) {
      mountEl = document.createElement('div');
      mountEl.dataset.pseudoMount = '';
      shadow.appendChild(mountEl);
    }
    mountElRef.current = mountEl;

    // R23.3: separate overlay host pinned to the viewport origin.
    //
    // Why this exists: PrimeReact positions overlay panels with
    // `position: absolute` and sets `style.top/left` to the
    // *viewport-relative* coordinates of the trigger
    // (`getBoundingClientRect().top + windowScrollTop`). Those
    // coordinates only land in the right place when the panel's
    // CSS `offsetParent` is at viewport origin — i.e. when the
    // overlay is mounted under `document.body`, which is
    // PrimeReact's normal `appendTo` default.
    //
    // We can't use document.body because the panel's structural
    // and theme CSS lives inside the shadow root (R10 + R23.1).
    // The mount element where the SDK React tree lives can't be
    // used either: it sits in normal block flow and has its own
    // offset from the viewport, so PrimeReact's viewport-relative
    // coordinates end up double-counting that offset (R23.2's
    // attempt to `position: relative` the mount element made the
    // panel render but in the wrong place, sometimes spanning
    // hundreds of pixels past the trigger).
    //
    // The fix is a dedicated sibling element that's
    // `position: fixed; inset: 0` (zero-size, viewport origin),
    // sits *inside* the shadow root so the adopted PrimeReact CSS
    // applies, and accepts overlay portals through `appendTo`.
    // The host itself doesn't capture pointer events
    // (`pointer-events: none`) so it never blocks the SDK tree
    // underneath; PrimeReact panels (children) re-enable pointer
    // events by default so they remain interactive.
    let overlayHost = shadow.querySelector<HTMLDivElement>('[data-pseudo-overlay-host]');
    if (!overlayHost) {
      overlayHost = document.createElement('div');
      overlayHost.dataset.pseudoOverlayHost = '';
      overlayHost.style.position = 'fixed';
      overlayHost.style.top = '0';
      overlayHost.style.left = '0';
      overlayHost.style.width = '0';
      overlayHost.style.height = '0';
      overlayHost.style.pointerEvents = 'none';
      // Above the SDK tree so panels stack on top. PrimeReact
      // overlay panels carry their own z-index internally for the
      // panel-vs-panel order, this just keeps the whole overlay
      // layer above the form fields.
      overlayHost.style.zIndex = '1000';
      shadow.appendChild(overlayHost);
    }
    overlayHostRef.current = overlayHost;

    rootRef.current = createRoot(mountEl);
    setReady(true);

    // Mirror parent `html.dark` so VS Code light↔dark theme toggles
    // (or user toggles in the web shell) update the shadow stack.
    const observer = new MutationObserver(() => {
      const next = readAppTheme();
      setAppTheme((prev) => (prev === next ? prev : next));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      // R23: defer `root.unmount()` past the current React commit so
      // we don't trip React 18 / 19's
      //
      //   "Attempted to synchronously unmount a root while React was
      //    already rendering."
      //
      // guard. Refs are cleared synchronously so any subsequent
      // render that races with this cleanup sees `rootRef.current ===
      // null` and bails before touching the half-torn-down root.
      // Microtask (vs. setTimeout) keeps the unmount in the same
      // tick — fires the moment the current commit completes — but
      // outside React's render phase.
      const rootToUnmount = rootRef.current;
      rootRef.current = null;
      shadowRef.current = null;
      mountElRef.current = null;
      overlayHostRef.current = null;
      setReady(false);
      queueMicrotask(() => {
        rootToUnmount?.unmount();
      });
    };
  }, []);

  // Atomic theme stack swap. The browser applies adoptedStyleSheets
  // assignment in a single style recalc — no flicker.
  useEffect(() => {
    if (!ready) return;
    const shadow = shadowRef.current;
    if (!shadow) return;
    syncThemeLayers(shadow, { appTheme, tenant: tenantTokens });
  }, [ready, appTheme, tenantTokens]);

  // Render / re-render the SDK tree into the shadow root.
  //
  // `renderRoot={shadow}` lets the SDK adopt its own
  // `pseudo-ui-react.css` (Layer 4) and routes PrimeReact overlay
  // portals to the shadow host element.
  //
  // `primeReactConfig.styleContainer = shadow` is critical for v10
  // components: each PrimeReact component carries its own
  // *structural* CSS as a `styles` string bundled into its
  // component JS (Stepper layout flex, separator `flex: 1 1 0`,
  // Dropdown `.p-hidden-accessible` peers, etc.). PrimeReact's
  // `useStyle` hook reads `context.styleContainer || document.head`
  // and appends a `<style>` element there. Without our override
  // those style elements land in the *parent* document and never
  // reach the shadow tree — so the SDK render appears un-styled
  // (Stepper indicators stay as raw squares with no separators,
  // Dropdown native peers leak, etc.). We do NOT set
  // `theme.preset` — design tokens come from the static MDC
  // theme + Forge default overrides adopted via `syncThemeLayers`.
  useEffect(() => {
    if (!ready || !rootRef.current || !shadowRef.current) return;
    const primeReactConfig: Record<string, unknown> = {
      styleContainer: shadowRef.current as unknown as HTMLElement,
      // R23.3: portal every PrimeReact overlay (Dropdown panel,
      // AutoComplete, Calendar, Tooltip, Menu) into the dedicated
      // viewport-anchored overlay host. The host is `position:
      // fixed; inset: 0` so PrimeReact's viewport-relative
      // `style.top/left` coordinates land in the right place
      // without any offsetParent math correction. SDK PseudoView
      // spreads our primeReactConfig after its own
      // `appendTo: renderRoot.host` default, so this override wins.
      appendTo: overlayHostRef.current as HTMLElement | null,
    };
    rootRef.current.render(
      <PseudoView
        schema={props.schema}
        view={props.view}
        formData={props.formData}
        instanceData={props.instanceData}
        lang={props.lang}
        delegate={props.delegate}
        onFormChange={props.onFormChange}
        designer={props.designer}
        selectedNodePath={props.selectedNodePath}
        designerClassNames={props.designerClassNames}
        renderRoot={shadowRef.current}
        primeReactConfig={primeReactConfig}
      />,
    );
  }, [
    ready,
    props.schema,
    props.view,
    props.formData,
    props.instanceData,
    props.lang,
    props.delegate,
    props.onFormChange,
    props.designer,
    props.selectedNodePath,
    props.designerClassNames,
  ]);

  return (
    <div
      ref={hostRef}
      style={{
        display: 'block',
        width: '100%',
        minHeight: 0,
        height: props.fillHeight ? '100%' : 'auto',
        isolation: 'isolate',
      }}
    />
  );
}
