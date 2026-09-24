import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { HumanTaskTab, type HumanTaskTabProps } from './HumanTaskTab';

const APPROVER: RoleGrant[] = [{ role: 'ht-approver', grant: 'allow' }];

function render(overrides: Partial<HumanTaskTabProps> = {}): string {
  const props: HumanTaskTabProps = {
    stateType: 2,
    subType: 6,
    queryRoles: [],
    workflowQueryRoles: [],
    offeredTransitions: [
      { key: 'ht-a-approve', source: 'state' },
      { key: 'cancel', source: 'cancel' },
    ],
    interaction: null,
    onUpdateQueryRoles: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HumanTaskTab, props));
}

describe('HumanTaskTab', () => {
  it('puts required queryRoles first and explains the fail-closed gate', () => {
    const html = render();
    expect(html.indexOf('Query roles (required)')).toBeLessThan(html.indexOf('Task text'));
    expect(html).toContain('fails closed');
    expect(html).toContain('listed for nobody');
  });

  it('accepts the workflow queryRoles as the fallback gate', () => {
    const html = render({ workflowQueryRoles: APPROVER });
    expect(html).not.toContain('listed for nobody');
    expect(html).toContain('workflow queryRoles apply');
  });

  it('shows state queryRoles in the editor', () => {
    expect(render({ queryRoles: APPROVER })).toContain('value="ht-approver"');
  });

  it('explains where the task text comes from, with a mapping snippet', () => {
    const html = render();
    expect(html).toContain('humanTask.title');
    expect(html).toContain('humanTask.description');
    expect(html).toContain('new ExpandoObject()');
  });

  it('lists the offered transitions and the interaction status', () => {
    const html = render({ interaction: { longPoll: { terminate: true, fallbackTimeoutSeconds: 600, roles: [] } } });
    expect(html).toContain('ht-a-approve');
    expect(html).toContain('Cancel');
    expect(html).toContain('Long poll · terminate · 600s · roles');
  });

  it('warns that Final and SubFlow states are never listed', () => {
    expect(render({ stateType: 3 })).toContain('never appear in the human-task list');
  });
});
