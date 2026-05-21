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

function getRootClasses(html: string): string[] {
  const match = html.match(/^<div class="([^"]+)"/);
  return match ? (match[1] ?? '').split(' ') : [];
}

describe('ScriptTaskForm metadata-only notice', () => {
  it('explains that script tasks are configured where they are used', () => {
    const html = renderPickPhase();

    expect(html).toContain('Script tasks are defined as metadata only');
    expect(html).toContain('Mapping scripts are written where the task is used within a workflow state');
  });

  it('does not lock its root to legacy editor heights', () => {
    const html = renderPickPhase();

    expect(html).not.toContain('min(90vh,1080px)');
    expect(html).not.toContain('min-h-[560px]');
    expect(html).not.toMatch(/height:\s*\d+px/);
  });

  it('does not chain h-full from its parent (which would let the Metadata card squash the script editor)', () => {
    const html = renderPickPhase();

    expect(getRootClasses(html)).not.toContain('h-full');
  });

  it('uses a compact notice layout so the configuration card can flow inside body scroll', () => {
    const html = renderPickPhase();
    const rootClasses = getRootClasses(html);
    const hasClampedHeight = rootClasses.some((c) => c.startsWith('h-[clamp('));
    const hasViewportHeight = rootClasses.some((c) => c.includes('vh'));

    expect(hasClampedHeight).toBe(false);
    expect(hasViewportHeight).toBe(false);
    expect(rootClasses).toEqual(expect.arrayContaining(['flex', 'items-start']));
    expect(rootClasses).not.toContain('overflow-hidden');
  });
});
