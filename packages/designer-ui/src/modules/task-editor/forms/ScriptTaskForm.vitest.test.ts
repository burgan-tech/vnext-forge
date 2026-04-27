import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ScriptTaskForm } from './ScriptTaskForm.js';

function renderPickPhase() {
  return renderToStaticMarkup(
    createElement(ScriptTaskForm, {
      config: {},
      onChange: () => {},
    }),
  );
}

/**
 * Edit phase is selected by the `useState` initializer when the config
 * already references a script with a valid relative location. With this
 * shape SSR renders the edit-phase wrapper directly, no `useEffect` flicker
 * required.
 */
function renderEditPhase() {
  return renderToStaticMarkup(
    createElement(ScriptTaskForm, {
      config: {
        location: './SampleMapping.csx',
        script: 'cHVibGljIGNsYXNzIFNhbXBsZSB7fQ==',
        encoding: 'B64',
      },
      onChange: () => {},
    }),
  );
}

function getRootClasses(html: string): string[] {
  const match = html.match(/^<div class="([^"]+)"/);
  return match ? (match[1] ?? '').split(' ') : [];
}

describe('ScriptTaskForm root layout', () => {
  /**
   * Locking in two regressions at once:
   *  - The original 90vh / 1080px / 560px floor caused the visible
   *    "code lines stack on top of each other" Monaco glitch in the VS
   *    Code webview (panel claimed more height than the body could give).
   *  - The follow-up `h-full + min-h-0 + flex-col` chain caused the
   *    editor area to collapse to ~0 because Metadata (shrink-0) ate the
   *    full body height and left no room for the Configuration card.
   * Neither shape is acceptable. The form root must use a stable, clamped
   * pixel/vh height that fits inside a typical body even with the Metadata
   * card above it, AND it must not chain `h-full` to its parent.
   */
  it('does not lock its root to the legacy viewport-relative height (90vh / 1080px / 560px floor)', () => {
    const html = renderEditPhase();
    expect(html).not.toContain('min(90vh,1080px)');
    expect(html).not.toContain('min-h-[560px]');
  });

  it('does not chain h-full from its parent (which would let the Metadata card squash the script editor)', () => {
    const pickHtml = renderPickPhase();
    const editHtml = renderEditPhase();
    expect(getRootClasses(pickHtml)).not.toContain('h-full');
    expect(getRootClasses(editHtml)).not.toContain('h-full');
  });

  it('uses a floored integer pixel height in the edit phase (inline style) so Monaco gets a stable, bounded parent', () => {
    const html = renderEditPhase();
    const rootClasses = getRootClasses(html);
    /**
     * Replaces CSS `h-[clamp(...)]` (subpixel) with `style="height: Npx"`.
     * SSR initial height is 400; client refines to floor(min(720, max(360, 55vh))).
     */
    expect(html).toMatch(/height:\s*\d+px/);
    expect(rootClasses).toEqual(expect.arrayContaining(['flex', 'flex-col', 'overflow-hidden']));
  });

  it('keeps the pick-phase root free of fixed/clamped height so the script picker can flow inside the body scroll', () => {
    const html = renderPickPhase();
    const rootClasses = getRootClasses(html);
    const hasClampedHeight = rootClasses.some((c) => c.startsWith('h-[clamp('));
    const hasViewportHeight = rootClasses.some((c) => c.includes('vh'));
    expect(hasClampedHeight).toBe(false);
    expect(hasViewportHeight).toBe(false);
    expect(rootClasses).toEqual(expect.arrayContaining(['flex', 'flex-col']));
  });
});
