import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HUMAN_TASK_GATE_MISSING_LABEL, HumanTaskGateDot, LongPollIndicator } from './StateNodeIndicators';

describe('LongPollIndicator', () => {
  it('renders a labelled radio-tower icon for a long poll', () => {
    const html = renderToStaticMarkup(
      createElement(LongPollIndicator, { hasLongPoll: true, longPollAuth: 'rule', terminate: true }),
    );
    expect(html).toContain('title="Long poll · terminate · 60s (default) · rule"');
    expect(html).toContain('<svg');
  });

  it('renders nothing without a long poll', () => {
    expect(renderToStaticMarkup(createElement(LongPollIndicator, {}))).toBe('');
  });
});

describe('HumanTaskGateDot', () => {
  it('renders the warning dot only when the gate is missing', () => {
    expect(renderToStaticMarkup(createElement(HumanTaskGateDot, { show: true }))).toContain(
      HUMAN_TASK_GATE_MISSING_LABEL,
    );
    expect(renderToStaticMarkup(createElement(HumanTaskGateDot, { show: false }))).toBe('');
  });
});
