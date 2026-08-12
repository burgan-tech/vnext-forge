import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CorrelationInfo } from '../types/quickrun.types';

const { CorrelationsTabContent } = await import('./CorrelationsTab.js');

const INSTANCE_ID = 'cd7b92a9-4107-493e-b69f-4f22030a83f1';
const CORRELATION_ID = '7e818ec4-89d7-4177-b506-80df17470417';

const ACTIVE: CorrelationInfo = {
  correlationId: CORRELATION_ID,
  parentState: 'received-documents',
  subFlowInstanceId: INSTANCE_ID,
  subFlowType: 'P',
  subFlowDomain: 'core',
  subFlowName: 'online-flow',
  subFlowVersion: '1.0.0',
  isCompleted: false,
};

const COMPLETED: CorrelationInfo = {
  ...ACTIVE,
  correlationId: 'fa6a52f6-bbf7-41e4-8e17-b1c59e8a367d',
  subFlowInstanceId: '92f5d821-9c67-4aa2-9cb0-f928c879253b',
  isCompleted: true,
  terminalOutcome: 'faulted',
  currentState: 'pre-approved',
};

describe('Correlations tab', () => {
  it('renders ids in full so they can be copied, not a 12-char prefix', () => {
    const html = renderToStaticMarkup(
      createElement(CorrelationsTabContent, {
        activeCorrelations: [ACTIVE],
        correlations: undefined,
      }),
    );
    expect(html).toContain(INSTANCE_ID);
    expect(html).toContain(CORRELATION_ID);
    expect(html).toContain('Copy sub-flow instance ID');
    expect(html).toContain('Copy correlation ID');
  });

  it('hides the Active/All switch against engines that send no full correlations list', () => {
    const html = renderToStaticMarkup(
      createElement(CorrelationsTabContent, {
        activeCorrelations: [ACTIVE],
        correlations: undefined,
      }),
    );
    expect(html).not.toContain('Correlation filter');
  });

  it('offers the Active/All switch once the engine sends the full list', () => {
    const html = renderToStaticMarkup(
      createElement(CorrelationsTabContent, {
        activeCorrelations: [ACTIVE],
        correlations: [ACTIVE, COMPLETED],
      }),
    );
    expect(html).toContain('Correlation filter');
    expect(html).toContain('All (2)');
    // Default view stays Active, so the completed entry is not listed yet.
    expect(html).not.toContain(COMPLETED.subFlowInstanceId);
  });

  it('says so rather than rendering an empty list when nothing is correlated', () => {
    const html = renderToStaticMarkup(
      createElement(CorrelationsTabContent, {
        activeCorrelations: [],
        correlations: undefined,
      }),
    );
    expect(html).toContain('No active correlations');
  });

  it('omits the row actions for hosts that cannot navigate', () => {
    const html = renderToStaticMarkup(
      createElement(CorrelationsTabContent, {
        activeCorrelations: [ACTIVE],
        correlations: undefined,
      }),
    );
    expect(html).not.toContain('Open Runner');
    expect(html).not.toContain('Open in Designer');
  });

  it('offers the row actions once the host supplies a handler', () => {
    const html = renderToStaticMarkup(
      createElement(CorrelationsTabContent, {
        activeCorrelations: [ACTIVE],
        correlations: undefined,
        onOpenSubFlowTarget: () => undefined,
      }),
    );
    expect(html).toContain('Open Runner');
    expect(html).toContain('Open in Designer');
  });
});
