import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { AwaitingAckPhase } from '../hooks/interactionMachine';
import { InteractionBanner } from './InteractionBanner';

const PHASE: AwaitingAckPhase = {
  kind: 'awaitingAck',
  instanceId: 'i1',
  stateName: 'review',
  deadlineMs: 60_000,
  fallbackTimeoutSeconds: 60,
  acking: false,
  waitingForFallback: false,
  error: null,
};

const render = (phase: Partial<AwaitingAckPhase> = {}, nowMs = 15_000) =>
  renderToStaticMarkup(
    createElement(InteractionBanner, {
      phase: { ...PHASE, ...phase },
      nowMs,
      onAcknowledge: () => undefined,
      onWaitForFallback: () => undefined,
    }),
  );

describe('InteractionBanner', () => {
  it('offers Acknowledge and Wait for fallback with the countdown', () => {
    const html = render();
    expect(html).toContain('Awaiting acknowledge');
    expect(html).toContain('Acknowledge</button>');
    expect(html).toContain('Wait for fallback</button>');
    expect(html).toContain('resumes in 45s');
  });

  it('hides Wait for fallback once chosen', () => {
    const html = render({ waitingForFallback: true });
    expect(html).not.toContain('Wait for fallback</button>');
    expect(html).toContain('Waiting for the fallback');
  });

  it('disables the buttons while acknowledging', () => {
    const html = render({ acking: true });
    expect(html).toContain('Acknowledging…');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Acknowledging…<\/button>/);
  });

  it('shows the runtime error of a refused acknowledge', () => {
    const html = render({
      error: { code: 'RUNTIME_EXECUTION_FAILED', message: 'Runtime returned HTTP 403', details: { httpStatus: 403 } },
    });
    expect(html).toContain('Acknowledge failed');
    expect(html).toContain('HTTP 403');
  });

  it('says it is resuming once the deadline passed', () => {
    expect(render({}, 70_000)).toContain('resuming…');
  });
});
