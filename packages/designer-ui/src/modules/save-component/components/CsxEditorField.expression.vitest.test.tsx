/**
 * Dynamic Expresso as the default in rule slots: a `condition` slot (and a value slot that opts in, the
 * resource-lock key) offers "Create Dynamic Expression" first and edits a
 * `{ location: "dynamicExpresso", encoding: "NAT" }` value inline; other slots keep the C# choices only.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CsxEditorField } from './CsxEditorField';
import { expressionHelp } from './dynamicExpression';
import { slotSurfaceOf } from '../../expressions/expressionCatalog';
import { suggestionsFor } from '../../expressions/suggestionsFor';
import { expressionTokenAt } from '../declarative-mapping/declarativeMappingCompletions';

const base = { stateKey: 's', listField: 'transitions', index: 0, scriptField: 'rule', onChange: () => {} };

describe('CsxEditorField — Dynamic Expression mode', () => {
  it('a condition slot offers the expression first, the C# script second', () => {
    const html = renderToStaticMarkup(
      createElement(CsxEditorField, { ...base, value: null, templateType: 'condition', label: 'Condition' }),
    );
    expect(html).toContain('Create Dynamic Expression');
    expect(html.indexOf('Create Dynamic Expression')).toBeLessThan(html.indexOf('Create C# Condition (.csx)'));
  });

  it('a value slot opts in explicitly; a plain mapping slot does not offer it', () => {
    const lock = renderToStaticMarkup(
      createElement(CsxEditorField, { ...base, value: null, templateType: 'mapping', expressionKind: 'value' }),
    );
    expect(lock).toContain('Create Dynamic Expression');
    const mapping = renderToStaticMarkup(
      createElement(CsxEditorField, { ...base, value: null, templateType: 'mapping' }),
    );
    expect(mapping).not.toContain('Create Dynamic Expression');
  });

  it('edits a dynamicExpresso value inline, empty included', () => {
    const value = { location: 'dynamicExpresso', encoding: 'NAT' as const, code: 'context.Body["amount"].AsDouble() > 1000' };
    const html = renderToStaticMarkup(createElement(CsxEditorField, { ...base, value, templateType: 'condition' }));
    expect(html).toContain('data-testid="dynamic-expression"');
    expect(html).toContain('context.Body[&quot;amount&quot;].AsDouble() &gt; 1000');
    const empty = renderToStaticMarkup(
      createElement(CsxEditorField, { ...base, value: { ...value, code: '' }, templateType: 'condition' }),
    );
    expect(empty).toContain('data-testid="dynamic-expression"');
    expect(empty).toContain('publish rejects it');
  });

  it('a C# rule keeps the script card', () => {
    const value = { location: './src/Rule.csx', encoding: 'NAT' as const, code: 'return true;' };
    const html = renderToStaticMarkup(createElement(CsxEditorField, { ...base, value, templateType: 'condition' }));
    expect(html).not.toContain('data-testid="dynamic-expression"');
    expect(html).toContain('./src/Rule.csx');
  });
});

describe('CsxEditorField — value expression kinds (timer, string, decision)', () => {
  const VARIABLES = ['data', 'input', 'instance', 'now', 'user', 'headers', 'context'];
  const expr = { location: 'dynamicExpresso', encoding: 'NAT' as const, code: '' };

  it.each(['timer', 'string', 'decision'] as const)('a %s slot offers the expression and names the new variables', (kind) => {
    const create = renderToStaticMarkup(
      createElement(CsxEditorField, { ...base, value: null, templateType: 'mapping', expressionKind: kind }),
    );
    expect(create).toContain('Create Dynamic Expression');
    const html = renderToStaticMarkup(
      createElement(CsxEditorField, { ...base, value: expr, templateType: 'mapping', expressionKind: kind }),
    );
    expect(html).toContain('data-testid="dynamic-expression"');
    for (const variable of VARIABLES) expect(html).toContain(variable);
    expect(html).toContain('hasRole');
    expect(html).toContain('headers.has(');
  });

  it('timer explains the schedule results and rejects numbers', () => {
    const help = expressionHelp('timer');
    expect(help.hint).toContain('TimeSpan.FromMinutes(15.0)');
    expect(help.hint).toContain('now.AddHours(2)');
    expect(help.hint).toContain('"PT15M"');
    expect(help.hint).toContain('null = immediately');
    expect(help.hint).toContain('numbers are rejected');
  });

  it('decision mentions outcome and candidates; string is the prompt', () => {
    expect(expressionHelp('decision').hint).toContain('outcome');
    expect(expressionHelp('decision').hint).toContain('candidates');
    expect(expressionHelp('decision').hint).toContain('null = no decision');
    expect(expressionHelp('string').hint).toContain('String result');
  });

  it('every kind names the same variable set (data, input, instance, now, user, context)', () => {
    for (const kind of ['condition', 'value', 'timer', 'string', 'decision'] as const) {
      const hint = expressionHelp(kind).hint;
      for (const variable of ['data', 'input', 'instance', 'now', 'user', 'context']) expect(hint).toContain(variable);
    }
    expect(expressionHelp('condition').hint).toContain('Boolean result');
  });
});

describe('CsxEditorField — expression suggestions per slot', () => {
  const suggest = (kind: 'value' | 'decision', text: string) => {
    const token = expressionTokenAt(text, text.length);
    return token ? suggestionsFor(slotSurfaceOf(kind), token, undefined) : [];
  };

  it('typing sh in a value slot suggests sha256', () => {
    expect(suggest('value', 'sh')).toContain('sha256()');
  });

  it('outcome. in a decision slot suggests decision', () => {
    expect(suggest('decision', 'outcome.')).toContain('decision');
  });

  it('renders the highlighted textarea on the slot surface', () => {
    const value = { location: 'dynamicExpresso', encoding: 'NAT' as const, code: 'sha256("a")' };
    const html = renderToStaticMarkup(
      createElement(CsxEditorField, { ...base, value, templateType: 'mapping', expressionKind: 'value' }),
    );
    expect(html).toContain('data-testid="expression-mirror"');
    expect(html).toContain('sha256');
  });

  it('data. in a condition slot suggests the master schema properties; CsxEditorField accepts schemaRoot', () => {
    const schemaRoot = { type: 'object', properties: { amount: { type: 'number' }, customer: { type: 'object' } } };
    const token = expressionTokenAt('data.', 5);
    const items = token ? suggestionsFor(slotSurfaceOf('condition'), token, schemaRoot) : [];
    expect(items).toEqual(expect.arrayContaining(['amount', 'customer']));
    const value = { location: 'dynamicExpresso', encoding: 'NAT' as const, code: 'data.amount > 1' };
    const html = renderToStaticMarkup(
      createElement(CsxEditorField, { ...base, value, templateType: 'condition', schemaRoot }),
    );
    expect(html).toContain('data-testid="expression-mirror"');
  });
});
