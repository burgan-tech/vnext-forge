import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceReference, SubFlowConfig } from '@vnext-forge-studio/vnext-types';
import type { ChildWorkflowSummary } from './childWorkflowSummary';

vi.mock('../../../../../../modules/save-component/components/CsxEditorField', () => ({
  CsxEditorField: () => null,
}));
vi.mock('../../../../../../modules/save-component/components/MappingScriptsSection', () => ({
  MappingScriptsSection: () => null,
}));
vi.mock('../ChooseExistingTaskDialog', () => ({
  ChooseExistingVnextComponentDialog: () => null,
}));

const { SubFlowOverridesSection } = await import('./SubFlowOverridesSection');

const PROCESS = { key: 'subflow-override-lab-child', domain: 'core', version: '1.0.2', flow: 'sys-flows' };
const ref = (key: string): ResourceReference => ({ key, domain: 'core', version: '1.0.0', flow: 'sys-views' });

const CHILD: ChildWorkflowSummary = {
  states: [
    { key: 'lp-wait', longPollAuth: 'rule', viewKeys: ['subflow-override-lab-child-lp-view'] },
    { key: 'child-done', longPollAuth: null, viewKeys: [] },
  ],
  transitions: [{ key: 'confirm', viewKeys: ['subflow-override-lab-child-confirm-view'] }],
};

function render(subFlow: SubFlowConfig, child: ChildWorkflowSummary | null = CHILD): string {
  return renderToStaticMarkup(
    createElement(SubFlowOverridesSection, {
      subFlow,
      stateKey: 'parent-subflow',
      child,
      childStatus: child ? 'ready' : 'unavailable',
      projectDomain: 'core',
      canPickViews: true,
      onUpdateSubFlow: () => undefined,
    }),
  );
}

describe('SubFlowOverridesSection', () => {
  it('shows the subflow type, child pickers, long-poll fields and warnings', () => {
    const html = render({
      type: 'S',
      process: PROCESS,
      overrides: {
        states: {
          'lp-wait': {
            interaction: { longPoll: { fallbackTimeoutSeconds: 120, roles: [{ role: 'ovr.parent-ack', grant: 'allow' }] } },
            views: { 'subflow-override-lab-child-lp-view': ref('subflow-override-lab-parent-lp-view') },
          },
        },
        transitions: { confirm: { roles: [] } },
      },
    });
    expect(html).toContain('Type:</span> SubFlow (S)');
    expect(html).toContain('value="lp-wait"');
    expect(html).toContain('value="confirm"');
    expect(html).toContain('Fallback window (s)');
    expect(html).toContain('value="120"');
    expect(html).toContain('value="subflow-override-lab-parent-lp-view"');
    expect(html).toContain('authorizes its long poll with a rule');
    expect(html).toContain('every caller is admitted');
  });

  it('hides the long-poll fields for a child state without a long poll', () => {
    const html = render({ type: 'S', process: PROCESS, overrides: { states: { 'child-done': { queryRoles: [{ role: 'a', grant: 'allow' }] } } } });
    expect(html).not.toContain('Fallback window (s)');
  });

  it('offers migration of legacy view overrides when the child selects every key', () => {
    const html = render({
      type: 'S',
      process: PROCESS,
      overrides: { views: { 'subflow-override-lab-child-lp-view': ref('subflow-override-lab-legacy-view') } },
    });
    expect(html).toContain('deprecated');
    expect(html).toContain('Migrate to scoped views');
  });

  it('explains free-text keys when the child is unavailable', () => {
    const html = render({ type: 'S', process: PROCESS, viewOverrides: { v: ref('x') } }, null);
    expect(html).toContain('Child workflow not found in this workspace');
    expect(html).not.toContain('Migrate to scoped views');
  });

  it('notes that a SubProcess ignores overrides', () => {
    const html = render({ type: 'P', process: PROCESS, overrides: { transitions: { confirm: { roles: [{ role: 'a', grant: 'allow' }] } } } });
    expect(html).toContain('SubProcess (P)');
    expect(html).toContain('overrides apply to SubFlow (S) only');
  });
});
