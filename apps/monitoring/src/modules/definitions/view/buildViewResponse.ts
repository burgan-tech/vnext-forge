import { normalizeDefinitionDoc, toDisplayText } from '@vnext-forge-studio/designer-ui';
import type { ViewResponse } from '@vnext-forge-studio/designer-ui/quickrun';
import { parseViewDisplay, ViewRenderer } from '@vnext-forge-studio/vnext-types';

const VIEW_TYPE_STRING: Record<number, string> = {
  1: 'Json',
  2: 'Html',
  3: 'Markdown',
  4: 'Deeplink',
  5: 'Http',
  6: 'URN',
};

/**
 * Builds the `ViewResponse` shape `PseudoUiViewSurface` expects from a raw
 * component definition. The monitor API may deliver the flattened shape
 * (`content`/`type`/… at the top level) or the canonical `attributes.*`
 * nesting, so normalize first and read from `attributes`.
 */
export function buildViewResponse(data: Record<string, unknown>): ViewResponse {
  const doc = normalizeDefinitionDoc('view', data);
  const attrs = (doc.attributes ?? {}) as Record<string, unknown>;
  const typeNum = attrs.type != null ? Number(attrs.type) : 1;
  // Mirrors the runtime response contract: `display` stays the SDI string (so
  // pre-MDI consumers are unaffected) and the per-mode declaration travels
  // separately in `modes`. Parsing first is what makes the object authoring form
  // resolve to its SDI value here instead of stringifying to `[object Object]`.
  const displayModes = parseViewDisplay(attrs.display);
  const renderer = toDisplayText(attrs.renderer);
  return {
    key: toDisplayText(doc.key),
    content: (attrs.content as Record<string, unknown>) ?? {},
    type: VIEW_TYPE_STRING[typeNum] ?? 'Json',
    display: displayModes.sdi,
    modes: displayModes.sdi !== undefined || displayModes.mdi !== undefined ? displayModes : undefined,
    renderer: renderer === '' ? ViewRenderer.PseudoUi : renderer,
  };
}
