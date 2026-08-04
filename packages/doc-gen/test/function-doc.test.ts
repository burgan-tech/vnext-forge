import { describe, expect, it } from 'vitest';

import { generateFunctionMarkdown } from '../src/generators/function-doc.js';

const base = {
  key: 'calc-fee',
  domain: 'core',
  version: '1.0.0',
  flow: 'sys-functions',
  flowVersion: '1.0.0',
  tags: ['calc-fee'],
};

function generate(attributes: Record<string, unknown>): string {
  return generateFunctionMarkdown({
    ...base,
    attributes: {
      scope: 'D',
      task: { order: 1, task: { key: 'fee-task', domain: 'core', flow: 'sys-tasks', version: '1.0.0' } },
      ...attributes,
    },
  });
}

const SCHEMA_REF = { key: 'fee-input', domain: 'core', version: '1.0.0', flow: 'sys-schemas' };
const VIEW_REF = { key: 'fee-form', domain: 'core', version: '1.0.0', flow: 'sys-views' };
const RULE = { location: './src/Rule.csx', code: 'Ly8=', encoding: 'B64' };

describe('generateFunctionMarkdown — contract section', () => {
  it('omits the Contract section when no contract field is set', () => {
    const md = generate({});
    expect(md).not.toContain('## Contract');
    // Sanity: the rest of the document still renders.
    expect(md).toContain('## Metadata');
    expect(md).toContain('## Task');
  });

  it('lists declared verbs', () => {
    const md = generate({ verbs: ['GET', 'POST'] });
    expect(md).toContain('## Contract');
    expect(md).toContain('**Verbs**: `GET`, `POST`');
  });

  it('renders a single reference as an always-selected row', () => {
    const md = generate({ inputSchema: SCHEMA_REF });
    expect(md).toContain('| Input Schema | Always | `fee-input` |');
  });

  it('renders rule entries in order, labelling the rule-less one as the fallback', () => {
    const md = generate({
      outputView: [
        { rule: RULE, view: { ...VIEW_REF, key: 'detailed' } },
        { view: { ...VIEW_REF, key: 'summary' } },
      ],
    });
    expect(md).toContain('| Output View | Rule #1 | `detailed` |');
    expect(md).toContain('| Output View | Fallback | `summary` |');
    expect(md.indexOf('`detailed`')).toBeLessThan(md.indexOf('`summary`'));
  });

  it('reads the wrapper wire shapes', () => {
    expect(generate({ inputView: { views: [{ view: VIEW_REF }] } })).toContain(
      '| Input View | Fallback | `fee-form` |',
    );
    expect(generate({ inputSchema: { schemas: [{ schema: SCHEMA_REF }] } })).toContain(
      '| Input Schema | Fallback | `fee-input` |',
    );
  });

  it('renders the { ref: "./file.json" } reference form', () => {
    const md = generate({ outputSchema: { ref: './schemas/out.json' } });
    expect(md).toContain('| Output Schema | Always | `./schemas/out.json` |');
  });

  it('renders all four slots together, in a stable order', () => {
    const md = generate({
      verbs: ['PATCH'],
      inputSchema: SCHEMA_REF,
      outputSchema: SCHEMA_REF,
      inputView: VIEW_REF,
      outputView: VIEW_REF,
    });
    const order = ['Input Schema', 'Output Schema', 'Input View', 'Output View'].map((label) =>
      md.indexOf(`| ${label} |`),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order]).toEqual([...order].sort((a, b) => a - b));
  });

  it('ignores a slot value that is not an object', () => {
    const md = generate({ inputView: 'nonsense' });
    expect(md).not.toContain('## Contract');
  });
});
