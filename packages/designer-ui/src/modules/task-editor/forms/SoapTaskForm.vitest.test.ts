import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SoapTaskForm } from './SoapTaskForm.js';

function renderSoapForm(config: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(SoapTaskForm, {
      config,
      onChange: () => {},
    }),
  );
}

describe('SoapTaskForm', () => {
  it('renders a required endpoint and optional SOAPAction field with SOAP 1.1 default', () => {
    const html = renderSoapForm();

    expect(html).toMatch(/URL<span[^>]*>\*<\/span>/);
    expect(html).toContain('SOAPAction');
    expect(html).not.toMatch(/SOAPAction<span[^>]*>\*<\/span>/);
    expect(html).toContain('SOAP Version');
    expect(html).toContain('<option value="1.1" selected="">1.1</option>');
  });

  it('renders XML body, headers, timeout, SSL, and accepted status code fields', () => {
    const html = renderSoapForm({
      body: '<Envelope />',
      headers: { Authorization: 'Bearer {token}' },
      acceptedStatusCodes: ['500'],
    });

    expect(html).toContain('Body (XML)');
    expect(html).toContain('&lt;Envelope /&gt;');
    expect(html).toContain('Authorization');
    expect(html).toContain('Timeout (seconds)');
    expect(html).toContain('Validate SSL');
    expect(html).toContain('Accepted Status Codes');
    expect(html).toContain('500');
  });
});
