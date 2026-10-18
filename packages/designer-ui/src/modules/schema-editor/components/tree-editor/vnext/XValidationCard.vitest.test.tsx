import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { toXValidationValue, XValidationFields } from './XValidationCard';

const render = (raw: Record<string, unknown>): string =>
  renderToStaticMarkup(
    createElement(XValidationFields, { value: toXValidationValue(raw), onChange: () => undefined }),
  );

describe('XValidationFields', () => {
  it('lists the rule kinds', () => {
    const html = render({ rule: 'remote', source: 'x' });
    for (const label of [
      'Equals field',
      'Not equal to field',
      'At most field',
      'At least field',
      'Remote (function)',
      'Custom (host)',
    ]) {
      expect(html).toContain(label);
    }
  });

  it('shows only the field input for a field rule', () => {
    const html = render({ rule: 'minField', parameters: { field: 'a.b' } });
    expect(html).toContain('Sibling path or $instance.… expression');
    expect(html).not.toContain('Result field');
    expect(html).not.toContain('Debounce (ms)');
    expect(html).toContain('Error messages');
  });

  it('shows the remote controls for a remote rule', () => {
    const html = render({ rule: 'remote', source: 'urn:vnext:fn:d:f' });
    expect(html).toContain('urn:vnext:fn:&lt;domain&gt;:&lt;function&gt;');
    for (const l of ['Result field', 'Message field', 'Trigger', 'Debounce (ms)', 'Parameters']) {
      expect(html).toContain(l);
    }
    expect(html).not.toContain('Sibling path');
  });

  it('shows the free rule input for a custom rule', () => {
    const html = render({ rule: 'validateStatus', parameters: {} });
    expect(html).toContain('validateStatus');
    expect(html).not.toContain('Result field');
    expect(html).not.toContain('Sibling path');
  });

  it('shows the required error for a remote rule without a function', () => {
    expect(render({ rule: 'remote' })).toContain('Function URN is required for a remote rule.');
    expect(render({ rule: 'remote', source: 'urn:x' })).not.toContain('Function URN is required');
  });

  it('shows the required error for a custom rule without a name', () => {
    expect(render({})).toContain('Rule name is required.');
    expect(render({ rule: 'abc' })).not.toContain('Rule name is required.');
  });
});
