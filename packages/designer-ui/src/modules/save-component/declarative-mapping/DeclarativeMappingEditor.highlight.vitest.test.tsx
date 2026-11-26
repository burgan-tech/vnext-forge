import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DeclarativeMappingEditor } from './DeclarativeMappingEditor';
import { SuggestInput } from './SuggestInput';
import { readMappingBlock, validateMappingBlock } from './declarativeMapping';

const render = (owner: 'task' | 'event', binding: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(DeclarativeMappingEditor, { binding, owner, onUpdate: () => {} }),
  );

describe('DeclarativeMappingEditor highlighting', () => {
  it('highlights a taskInput set expression and flags nothing', () => {
    const html = render('task', {
      input: { set: { '$.url': 'config.get("base") + urlEncode(data.id)' } },
    });
    expect(html).toContain('data-testid="expression-mirror"');
    expect(html).toMatch(/data-token="call"[^>]*>urlEncode</);
    expect(html).not.toContain('expression-diagnostic');
  });

  it('shows an advisory diagnostic for an eventInput set expression without touching the block', () => {
    const binding = { input: { set: { '$.key': 'data.id' } } };
    const before = JSON.stringify(binding);
    const html = render('event', binding);
    expect(html).toContain('data-testid="expression-diagnostic"');
    expect(JSON.stringify(binding)).toBe(before);
  });

  it('keeps the diagnostic advisory: it never sets aria-invalid, which comes from validateMappingBlock only', () => {
    const field = renderToStaticMarkup(
      createElement(SuggestInput, {
        mode: 'expression',
        surface: 'eventInput',
        value: 'data.id',
        onChange: () => {},
        ariaLabel: 'x',
      }),
    );
    expect(field).toContain('expression-diagnostic');
    expect(field).not.toContain('aria-invalid');
    const block = readMappingBlock({ input: { set: { '$.key': 'data.id' } } }, 'input');
    const html = render('event', { input: { set: { '$.key': 'data.id' } } });
    const invalid = validateMappingBlock('eventInput', block).some(
      (i) => i.severity === 'error' && i.part === 'expression',
    );
    expect(html.includes('aria-invalid="true"')).toBe(invalid);
  });

  it('renders without calling onUpdate', () => {
    const onUpdate = vi.fn();
    renderToStaticMarkup(
      createElement(DeclarativeMappingEditor, {
        binding: { input: { set: { '$.key': 'data.id' } } },
        owner: 'event',
        onUpdate,
      }),
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
