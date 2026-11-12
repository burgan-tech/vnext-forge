import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Same stub as FunctionContractSection's test: the modal button drags in the
// pseudo-ui editor graph, which Node's ESM resolver cannot load.
vi.mock('../../../../../save-component/components/OpenVnextComponentInModalButton.js', () => ({
  OpenVnextComponentInModalButton: () => null,
}));

const { TransitionSchemasSection } = await import('./TransitionSchemasSection.js');

const ref = (key: string) => ({ key, domain: 'core', flow: 'sys-schemas', version: '1.0.0' });
const rule = { location: './src/IsCorporate.csx', code: 'Ly8=', encoding: 'B64' };

function render(schemas: unknown, hasSingleSchema = false) {
  return renderToStaticMarkup(
    createElement(TransitionSchemasSection, {
      schemas,
      hasSingleSchema,
      onChange: () => {},
      stateKey: 'review',
      transitionKey: 'approve',
      transitionIndex: 0,
    }),
  );
}

describe('TransitionSchemasSection (runtime 0.0.105)', () => {
  it('edits the rule-entry list only — no single/rule-based toggle', () => {
    const html = render([{ rule, schema: ref('corporate-payload') }, { schema: ref('retail-payload') }]);
    expect(html).toContain('Rule-based schemas');
    expect(html).not.toContain('Single schema');
    expect(html).toContain('corporate-payload');
    expect(html).toContain('Fallback — always matches');
    expect(html).toContain('Transition:100025');
  });

  it('reads the wrapped { schemas } form', () => {
    expect(render({ schemas: [{ schema: ref('retail-payload') }] })).toContain('retail-payload');
  });

  it('tells the author schemas wins when a single schema is declared too', () => {
    expect(render([{ schema: ref('x') }], true)).toContain('Schemas take precedence');
    expect(render(undefined, true)).not.toContain('Schemas take precedence');
  });

  it('warns about a fallback that shadows later entries', () => {
    expect(render([{ schema: ref('x') }, { rule, schema: ref('y') }])).toContain('shadows the entries below it');
  });

  it('refuses to rewrite a lone reference (not a valid schemas value)', () => {
    expect(render(ref('x'))).toContain('Unrecognized schema contract');
  });
});
