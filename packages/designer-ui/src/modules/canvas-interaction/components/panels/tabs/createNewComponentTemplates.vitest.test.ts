import { describe, expect, it } from 'vitest';

import { schemaTypeAttribute } from '../../../../../vnext-defaults/vnextComponentTemplates';
import { CREATE_NEW_COMPONENT_META } from './createNewComponentTemplates';

const typeOf = (json: Record<string, unknown>) => (json.attributes as Record<string, unknown>).type;

describe('CREATE_NEW_COMPONENT_META.schemas', () => {
  it('writes the requested role on a 0.0.56+ project', () => {
    const json = CREATE_NEW_COMPONENT_META.schemas.template('orders', 'core', {
      schemaRole: 'transition',
      schemaVersion: '0.0.56',
    });
    expect(typeOf(json)).toBe('transition');
  });

  it('omits attributes.type when no role is requested', () => {
    const json = CREATE_NEW_COMPONENT_META.schemas.template('orders', 'core', { schemaVersion: '0.0.56' });
    expect(json.attributes).not.toHaveProperty('type');
  });

  it('keeps a legacy string on projects pinned below 0.0.56', () => {
    expect(typeOf(CREATE_NEW_COMPONENT_META.schemas.template('o', 'core', { schemaRole: 'master', schemaVersion: '0.0.55' }))).toBe(
      'master',
    );
    expect(
      typeOf(CREATE_NEW_COMPONENT_META.schemas.template('o', 'core', { schemaRole: 'transition', schemaVersion: '0.0.55' })),
    ).toBe('schema');
  });

  it('ignores the option for other categories', () => {
    const json = CREATE_NEW_COMPONENT_META.views.template('v', 'core', { schemaRole: 'master' });
    expect(typeOf(json)).toBe(1);
  });
});

describe('schemaTypeAttribute', () => {
  it('treats an unknown pin as role-enforcing', () => {
    expect(schemaTypeAttribute(undefined, 'function')).toEqual({ type: 'function' });
    expect(schemaTypeAttribute(undefined, undefined)).toEqual({});
  });
});
