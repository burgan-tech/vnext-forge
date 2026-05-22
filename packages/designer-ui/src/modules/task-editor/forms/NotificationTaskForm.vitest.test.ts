import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NotificationTaskForm } from './NotificationTaskForm.js';

function renderNotificationForm(config: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(NotificationTaskForm, {
      config,
      onChange: () => {},
    }),
  );
}

describe('NotificationTaskForm', () => {
  it('renders free-form channels and defaults state channel inclusion to yes', () => {
    const html = renderNotificationForm({ channels: ['sms', 'email'] });

    expect(html).toContain('Channels');
    expect(html).toContain('sms');
    expect(html).toContain('email');
    expect(html).toContain('Include State Channel');
    expect(html).toContain('<option value="true" selected="">Yes</option>');
  });

  it('renders includeStateChannel false as No', () => {
    const html = renderNotificationForm({ includeStateChannel: false });

    expect(html).toContain('<option value="false" selected="">No</option>');
  });
});
