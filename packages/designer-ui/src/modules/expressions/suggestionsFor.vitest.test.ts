import { describe, expect, it } from 'vitest';
import {
  expressionSuggestions,
  expressionTokenAt,
  insertExpressionItem,
} from '../save-component/declarative-mapping/declarativeMappingCompletions';
import { suggestionsFor } from './suggestionsFor';

const schema = {
  type: 'object',
  properties: {
    amount: { type: 'number' },
    customer: { type: 'object', properties: { name: { type: 'string' } } },
  },
};

const at = (text: string) => expressionTokenAt(text, text.length)!;

describe('suggestionsFor', () => {
  it('offers the slot functions as calls at the root', () => {
    expect(suggestionsFor('value', at('sh'), schema)).toContain('sha256()');
    expect(suggestionsFor('key', at('vary'), schema)).toContain('varyKey()');
    expect(suggestionsFor('condition', at('sh'), schema)).not.toContain('sha256()');
  });

  it('offers variables and statics at the root', () => {
    expect(suggestionsFor('condition', at('da'), schema)[0]).toBe('data');
    expect(suggestionsFor('timer', at('Time'), schema)).toContain('TimeSpan');
    expect(suggestionsFor('condition', at('Time'), schema)).not.toContain('TimeSpan');
  });

  it('offers the members of a known root', () => {
    expect(suggestionsFor('decision', at('outcome.'), schema)).toContain('decision');
    expect(suggestionsFor('condition', at('user.'), schema)).toContain('hasRole("")');
    expect(suggestionsFor('condition', at('outcome.'), schema)).toEqual([]);
  });

  it('offers schema children and conversions under data', () => {
    expect(suggestionsFor('condition', at('data.'), schema)).toEqual(['amount', 'customer']);
    expect(suggestionsFor('condition', at('data.amount.'), schema)).toContain('AsDouble()');
    expect(suggestionsFor('condition', at('instance.data.customer.'), schema)).toContain('name');
    expect(suggestionsFor('condition', at('instance.'), schema)).toContain('effectiveState');
  });

  it('offers no conversions on the agent tool surface', () => {
    expect(suggestionsFor('agentTool', at('data.x.'), schema)).not.toContain('AsDouble()');
    expect(suggestionsFor('agentTool', at('ar'), schema)).toEqual(['args']);
  });

  it('delegates block surfaces to expressionSuggestions', () => {
    for (const text of ['ur', 'data.', 'result.', 'task.']) {
      expect(suggestionsFor('taskInput', at(text), schema)).toEqual(
        expressionSuggestions('taskInput', at(text), schema),
      );
    }
    expect(suggestionsFor('functionOutput', at('result.'), schema, { resultSlots: ['credit'] })).toEqual([
      'credit',
    ]);
  });
});

describe('insertExpressionItem with slot functions', () => {
  it('lands the caret inside the parentheses of sha256() and varyKey()', () => {
    expect(insertExpressionItem('sh', at('sh'), 2, 'sha256()')).toEqual({ text: 'sha256()', caret: 7 });
    expect(insertExpressionItem('va', at('va'), 2, 'varyKey()')).toEqual({ text: 'varyKey()', caret: 8 });
  });

  it('still lands after a conversion', () => {
    const text = 'data.a.As';
    expect(insertExpressionItem(text, at(text), text.length, 'AsDouble()').caret).toBe('data.a.AsDouble()'.length);
  });
});
