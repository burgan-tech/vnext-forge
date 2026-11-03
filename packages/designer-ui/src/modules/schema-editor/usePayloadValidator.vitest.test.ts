import Ajv from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';

import { vocabularyKeywords } from './usePayloadValidator';

describe('vocabularyKeywords', () => {
  const schema = {
    type: 'object',
    properties: {
      doc: { type: 'object', 'x-storage': { binding: 'b', transport: 'stream' } },
      list: { type: 'array', items: { type: 'string', 'x-roles': [] } },
    },
  };

  it('collects every x-* keyword so strict Ajv compiles vocabulary schemas', () => {
    expect(vocabularyKeywords(schema).sort()).toEqual(['x-roles', 'x-storage']);
    expect(() => new Ajv({ allErrors: true }).compile(schema)).toThrow(/unknown keyword/);
    const ajv = new Ajv({ allErrors: true });
    for (const keyword of vocabularyKeywords(schema)) ajv.addKeyword(keyword);
    expect(ajv.compile(schema)({ doc: {}, list: ['a'] })).toBe(true);
  });
});
