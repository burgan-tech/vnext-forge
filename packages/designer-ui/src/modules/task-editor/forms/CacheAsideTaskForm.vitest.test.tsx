/**
 * CacheAside source mapping (runtime Phase B): the declarative `sourceInput` / `sourceOutput` blocks are
 * the default, the C# `sourceMapping` the alternative; a config opens in the mode it holds.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CacheAsideTaskForm } from './CacheAsideTaskForm';

const sourceTask = { key: 'src', domain: 'core', version: '1.0.0' };
const render = (config: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(CacheAsideTaskForm, { config: { sourceTask, ...config }, onChange: () => undefined }));

describe('CacheAsideTaskForm source mapping', () => {
  it('a config without a source mapping starts declarative with the source hints', () => {
    const html = render({});
    expect(html).toContain('data-testid="task-binding-mapping"');
    expect(html).toContain('data-testid="declarative-input"');
    expect(html).toContain('sourceOutput: shapes the source task result');
  });

  it('a config with sourceOutput shows the block', () => {
    const html = render({ sourceOutput: { select: '$.body.customer' } });
    expect(html).toContain('data-testid="declarative-output"');
    expect(html).toContain('$.body.customer');
  });

  it('a config with sourceMapping opens the C# editor', () => {
    const html = render({ sourceMapping: { location: './src/Source.csx', code: 'cmV0dXJuIG51bGw7', encoding: 'B64' } });
    expect(html).not.toContain('data-testid="declarative-input"');
    expect(html).toContain('./src/Source.csx');
  });

  it('a config with both warns that publish rejects it', () => {
    const html = render({
      sourceMapping: { location: './src/Source.csx', code: 'cmV0dXJuIG51bGw7', encoding: 'B64' },
      sourceInput: { set: { '$.url': '"x"' } },
    });
    expect(html).toContain('Publish rejects it');
  });
});
