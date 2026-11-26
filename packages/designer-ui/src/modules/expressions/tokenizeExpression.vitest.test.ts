import { describe, expect, it } from 'vitest';
import type { ExpressionSurface } from './expressionCatalog';
import { diagnoseExpression, tokenizeExpression, tokenizePath } from './tokenizeExpression';

const kinds = (text: string, surface: ExpressionSurface) =>
  tokenizeExpression(text, surface).map((t) => t.kind);
const slice = (text: string, surface: ExpressionSurface, kind: string) =>
  tokenizeExpression(text, surface)
    .filter((t) => t.kind === kind)
    .map((t) => text.slice(t.start, t.end));

describe('tokenizeExpression', () => {
  it('classifies a rule', () => {
    expect(kinds('data.amount.AsDouble() > 100', 'condition')).toEqual([
      'variable', 'punctuation', 'member', 'punctuation', 'call', 'punctuation', 'punctuation',
      'whitespace', 'operator', 'whitespace', 'number',
    ]);
  });

  it('keeps a header indexer string whole', () => {
    expect(slice('headers["x-channel"]', 'condition', 'string')).toEqual(['"x-channel"']);
  });

  it('handles escaped quotes inside a string', () => {
    expect(slice('"a\\"b" == x', 'condition', 'string')).toEqual(['"a\\"b"']);
  });

  it('classifies keywords, unknown roots and root functions', () => {
    expect(kinds('true', 'condition')).toEqual(['keyword']);
    expect(kinds('foo', 'condition')).toEqual(['unknownRoot']);
    expect(kinds('urlEncode(x)', 'taskInput')[0]).toBe('call');
    expect(kinds('sha256', 'value')).toEqual(['variable']);
  });

  it('unterminated string', () => {
    expect(slice('"abc', 'condition', 'string')).toEqual(['"abc']);
    expect(diagnoseExpression('"abc', 'condition').map((d) => d.message)).toEqual([
      'The string is not closed.',
    ]);
  });

  it('empty text', () => {
    expect(tokenizeExpression('', 'condition')).toEqual([]);
    expect(diagnoseExpression('', 'condition')).toEqual([]);
  });

  it('tokens cover the text', () => {
    for (const s of ['data.a == "x" && now > 1.5', '  a  ', 'x => x.y ?? @', '"open', 'a.b(c)[0]']) {
      const tokens = tokenizeExpression(s, 'condition');
      let pos = 0;
      for (const t of tokens) {
        expect(t.start).toBe(pos);
        pos = t.end;
      }
      expect(pos).toBe(s.length);
    }
  });

  it('memoizes and returns the same array', () => {
    expect(tokenizeExpression('data.x', 'condition')).toBe(tokenizeExpression('data.x', 'condition'));
    expect(tokenizeExpression('data.x', 'condition')).not.toBe(tokenizeExpression('data.x', 'value'));
  });
});

describe('diagnoseExpression', () => {
  it('flags data in an event input mapping', () => {
    const d = diagnoseExpression('data.x', 'eventInput');
    expect(d[0]).toMatchObject({ start: 0, end: 4 });
    expect(d[0].message).toContain('Variables: input, now, context, headers');
  });

  it('accepts data in an agent tool binding', () => {
    expect(diagnoseExpression('data.x', 'agentTool')).toEqual([]);
  });

  it('does not flag lambdas or statics', () => {
    expect(diagnoseExpression('candidates.keys.Any(k => k == "a")', 'decision')).toEqual([]);
    expect(diagnoseExpression('TimeSpan.FromMinutes(5.0)', 'condition')).toEqual([]);
  });

  it('does not flag a surface function', () => {
    expect(diagnoseExpression('sha256(data.a)', 'value')).toEqual([]);
  });
});

describe('tokenizePath', () => {
  it('tokenizes a path', () => {
    expect(tokenizePath('$.customer["first name"][0]').map((t) => t.kind)).toEqual([
      'root', 'punctuation', 'segment', 'index', 'index',
    ]);
  });
});
