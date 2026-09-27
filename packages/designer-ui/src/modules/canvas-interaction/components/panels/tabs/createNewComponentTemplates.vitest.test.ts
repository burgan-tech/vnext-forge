import { describe, expect, it } from 'vitest';

import { CREATE_NEW_COMPONENT_META } from './createNewComponentTemplates';

describe('CREATE_NEW_COMPONENT_META.schemas', () => {
  it('uses the requested attributes.type', () => {
    const json = CREATE_NEW_COMPONENT_META.schemas.template('orders', 'core', { schemaType: 'master' });
    expect((json.attributes as Record<string, unknown>).type).toBe('master');
  });

  it('keeps the previous default when no type is requested', () => {
    const json = CREATE_NEW_COMPONENT_META.schemas.template('orders', 'core');
    expect((json.attributes as Record<string, unknown>).type).toBe('workflow');
  });

  it('ignores the option for other categories', () => {
    const json = CREATE_NEW_COMPONENT_META.views.template('v', 'core', { schemaType: 'master' });
    expect((json.attributes as Record<string, unknown>).type).toBe(1);
  });
});
