import { describe, expect, it } from 'vitest';

import sampleCustomerRegistrationView from '../__fixtures__/customer-registration-form.view.json';
import {
  EMPTY_DEFINITION,
  parseBuilderDefinition,
  serializeBuilderDefinition,
} from './normalizeDefinition';

describe('parseBuilderDefinition', () => {
  it('round-trips full pseudo-ui view definitions', () => {
    const source = {
      $schema: 'https://amorphie.io/schemas/pseudo-ui-view.json',
      dataSchema: 'urn:amorphie:schema:customer',
      lookups: ['branchDetail'],
      view: {
        type: 'Column',
        gap: 'md',
        children: [
          { type: 'TextField', bind: 'firstName' },
          { type: 'Button', label: { en: 'Continue' }, action: 'submit', command: 'next' },
        ],
      },
    };

    const parsed = parseBuilderDefinition(JSON.stringify(source));
    expect(parsed).toMatchObject(source);
  });

  it('falls back to EMPTY_DEFINITION for empty or invalid input', () => {
    expect(parseBuilderDefinition('')).toEqual(EMPTY_DEFINITION);
    expect(parseBuilderDefinition('not json')).toEqual(EMPTY_DEFINITION);
    expect(parseBuilderDefinition(null)).toEqual(EMPTY_DEFINITION);
  });

  it('repairs missing top-level fields without throwing', () => {
    const parsed = parseBuilderDefinition(
      JSON.stringify({ view: { type: 'Text', content: { en: 'Hi' } } }),
    );
    expect(parsed.view.type).toBe('Text');
    expect(parsed.$schema).toBe('https://amorphie.io/schemas/pseudo-ui-view.json');
    expect(parsed.dataSchema).toBe('');
  });

  it('accepts a real pseudo-ui SDK sample fixture', () => {
    const parsed = parseBuilderDefinition(JSON.stringify(sampleCustomerRegistrationView));
    expect(parsed.dataSchema).toBe('urn:vnext:res:schema:customer:registration-form');
    expect(parsed.view.type).toBe('ScrollView');
  });

  it('serialize → parse is idempotent', () => {
    const source = {
      $schema: 'https://amorphie.io/schemas/pseudo-ui-view.json',
      dataSchema: 'urn:x',
      view: { type: 'Column', children: [] },
    };
    const serialized = serializeBuilderDefinition(parseBuilderDefinition(JSON.stringify(source)));
    expect(parseBuilderDefinition(serialized)).toMatchObject(source);
  });
});
