import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TaskEditorPanel } from './TaskEditorPanel.js';

function renderTaskEditorPanel(taskType: string) {
  return renderToStaticMarkup(
    createElement(TaskEditorPanel, {
      json: {
        key: 'sample-task',
        version: '1.0.0',
        domain: 'openbanking',
        flow: 'sys-tasks',
        attributes: { type: taskType, config: {} },
      },
      onChange: () => {},
    }),
  );
}

function getRootClasses(html: string): string[] {
  const match = html.match(/^<div class="([^"]+)"/);
  return match ? (match[1] ?? '').split(' ') : [];
}

describe('TaskEditorPanel layout', () => {
  /**
   * Regression: previously we forced a `flex h-full min-h-0 flex-col` chain
   * on script tasks so Monaco could stretch into a flex-1 Configuration card.
   * In the VS Code webview the Metadata card (key/version/domain/flow grid +
   * task type picker + tag editor) is ~400px tall, and the body it sits in
   * is ~600px. With the panel pinned to `h-full`, Metadata (shrink-0)
   * dominated and the Configuration card collapsed to ~140px — leaving
   * < 40px for ScriptEditorPanel after Card chrome and Monaco's own header
   * / toolbar / status bar, so the editor area rendered as 0 height. The
   * fix is to keep the body as the scroll surface (block layout) for ALL
   * task types and let ScriptTaskForm own its own stable height.
   */
  it('uses the block layout (space-y-4 p-4) for script tasks so Metadata cannot squeeze the script editor card to zero height', () => {
    const html = renderTaskEditorPanel('5');
    const rootClasses = getRootClasses(html);
    expect(rootClasses).toEqual(expect.arrayContaining(['space-y-4', 'p-4']));
    expect(rootClasses).not.toContain('h-full');
    expect(rootClasses).not.toContain('flex-col');
  });

  it('uses the same block layout for non-script task types (no per-type branching)', () => {
    const html = renderTaskEditorPanel('6');
    const rootClasses = getRootClasses(html);
    expect(rootClasses).toEqual(expect.arrayContaining(['space-y-4', 'p-4']));
    expect(rootClasses).not.toContain('h-full');
  });

  /**
   * Both cards must keep their default natural sizing — no `flex-1`, no
   * `min-h-0`, no `overflow-hidden`. If we force any of those on the
   * Configuration card the script form inside cannot expand to its
   * clamped height (it instead matches whatever the flex algorithm gave
   * the card, which can be 0 when Metadata is tall).
   */
  it('does not pin the Configuration card to a flex-1 / overflow-hidden chain (the script form owns its own stable height)', () => {
    const html = renderTaskEditorPanel('5');
    const cardClassLists = Array.from(html.matchAll(/data-slot="card" class="([^"]+)"/g)).map(
      (m) => (m[1] ?? '').split(' '),
    );
    expect(cardClassLists.length).toBeGreaterThanOrEqual(2);
    const configurationCardClasses = cardClassLists[1] ?? [];
    expect(configurationCardClasses).not.toContain('flex-1');
    expect(configurationCardClasses).not.toContain('min-h-0');
    expect(configurationCardClasses).not.toContain('overflow-hidden');
  });
});
