import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FunctionTaskKeyCollisions } from './FunctionTaskKeyCollisions';
import { FunctionRolesSection, applyFunctionRoles } from './FunctionRolesSection';

describe('FunctionTaskKeyCollisions', () => {
  it('shows an error for colliding task keys', () => {
    const html = renderToStaticMarkup(
      createElement(FunctionTaskKeyCollisions, {
        tasks: [{ task: { key: 'user-info' } }, { task: { key: 'user_info' } }],
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Task keys collide');
    expect(html).toContain('userInfo');
  });

  it('renders nothing when keys are distinct', () => {
    expect(
      renderToStaticMarkup(createElement(FunctionTaskKeyCollisions, { tasks: [{ task: { key: 'a' } }, { task: { key: 'b' } }] })),
    ).toBe('');
  });
});

describe('FunctionRolesSection', () => {
  it('explains that roles are authorize-only grants', () => {
    const html = renderToStaticMarkup(
      createElement(FunctionRolesSection, {
        json: { attributes: { roles: [{ role: 'morph-idm.maker', grant: 'allow' }] } },
        onChange: () => undefined,
      }),
    );
    expect(html).toContain('not an invocation gate');
    expect(html).toContain('value="morph-idm.maker"');
  });

  it('writes roles and drops the key when the list is empty', () => {
    const draft: Record<string, unknown> = { attributes: { scope: 'I' } };
    applyFunctionRoles(draft, [{ role: 'a', grant: 'allow' }]);
    expect(draft).toEqual({ attributes: { scope: 'I', roles: [{ role: 'a', grant: 'allow' }] } });
    applyFunctionRoles(draft, []);
    expect(draft).toEqual({ attributes: { scope: 'I' } });
  });
});
