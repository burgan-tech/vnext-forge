import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StateTimeoutChip } from './StateTimeoutChip';

const NOW = Date.parse('2026-09-30T12:00:00Z');

describe('StateTimeoutChip', () => {
  it('renders nothing without a timeout', () => {
    expect(renderToStaticMarkup(createElement(StateTimeoutChip, { nowMs: NOW }))).toBe('');
  });

  it('shows key → target, the countdown and annotations', () => {
    const html = renderToStaticMarkup(
      createElement(StateTimeoutChip, {
        nowMs: NOW,
        timeout: {
          key: 'expire',
          target: 'expired',
          executeAtUtc: '2026-09-30T12:01:00Z',
          annotations: { 'ui/severity': 'warning' },
        },
      }),
    );
    expect(html).toContain('expire');
    expect(html).toContain('expired');
    expect(html).toContain('in 1m 0s');
    expect(html).toContain('ui/severity');
    expect(html).toContain('warning');
  });

  it('says Settling… when the timeout is due', () => {
    const html = renderToStaticMarkup(
      createElement(StateTimeoutChip, {
        nowMs: NOW,
        timeout: { key: 'expire', target: 'expired', executeAtUtc: '2026-09-30T11:00:00Z' },
      }),
    );
    expect(html).toContain('Settling…');
  });

  it('renders the runtime 0.0.99 target object by its label, not as a React child', () => {
    const html = renderToStaticMarkup(
      createElement(StateTimeoutChip, {
        nowMs: NOW,
        timeout: {
          key: 'expire',
          target: { key: 'expired', stateType: 'finish', labels: [{ language: 'en-US', label: 'Expired' }] },
          executeAtUtc: '2026-09-30T12:01:00Z',
        },
      }),
    );
    expect(html).toContain('Expired');
    expect(html).toContain('title="expired"');
  });
});
