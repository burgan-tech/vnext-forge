import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  remoteXValidationSupported,
  toXValidationValue,
  xValidationKindOptions,
  XValidationFields,
} from './XValidationCard';

const render = (raw: Record<string, unknown>, schemaVersion?: string): string =>
  renderToStaticMarkup(
    createElement(XValidationFields, {
      value: toXValidationValue(raw),
      onChange: () => undefined,
      ...(schemaVersion ? { schemaVersion } : {}),
    }),
  );

describe('remoteXValidationSupported', () => {
  it('needs vnext-schema 0.0.57 or later (pre-release suffixes count)', () => {
    expect(remoteXValidationSupported('0.0.55')).toBe(false);
    expect(remoteXValidationSupported('0.0.56')).toBe(false);
    expect(remoteXValidationSupported('0.0.57')).toBe(true);
    expect(remoteXValidationSupported('0.0.57-local.1')).toBe(true);
    expect(remoteXValidationSupported('0.1.0')).toBe(true);
  });

  it('treats an unknown pin as the bundled package (supported)', () => {
    expect(remoteXValidationSupported(undefined)).toBe(true);
    expect(remoteXValidationSupported('latest')).toBe(true);
  });
});

describe('xValidationKindOptions', () => {
  const kinds = (current: Parameters<typeof xValidationKindOptions>[0], v?: string) =>
    xValidationKindOptions(current, v).map((o) => o.kind);

  it('hides Remote on an older pin', () => {
    expect(kinds('equalsField', '0.0.56')).not.toContain('remote');
    expect(kinds('equalsField', '0.0.57')).toContain('remote');
  });

  it('keeps Remote for a stored remote rule on any pin', () => {
    expect(kinds('remote', '0.0.55')).toContain('remote');
  });
});

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

  it('does not offer Remote on a project pinned below 0.0.57', () => {
    expect(render({ rule: 'equalsField', parameters: { field: 'a' } }, '0.0.56')).not.toContain('Remote (function)');
    expect(render({ rule: 'remote', source: 'x' }, '0.0.56')).toContain('Remote (function)');
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
