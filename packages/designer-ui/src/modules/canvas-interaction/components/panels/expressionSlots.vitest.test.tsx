/**
 * Dynamic Expresso in value slots (runtime Phase A): the transition timer, the workflow timeout mapping,
 * the subflow timeout override mapping (`timer`), the agent prompt (`string`) and the agent decision
 * mapping (`decision`) pass `expressionKind` to `CsxEditorField`; the agent hints mapping stays C# only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../save-component/components/CsxEditorField', () => ({
  CsxEditorField: (props: { scriptField: string; expressionKind?: string }) =>
    createElement('div', { 'data-csx': `${props.scriptField}:${props.expressionKind ?? 'none'}` }),
}));
vi.mock('../../../save-component/components/MappingScriptsSection', () => ({
  MappingScriptsSection: () => null,
}));

const { TransitionTimerSection } = await import('./tabs/transition/TransitionTimerSection');
const { TimeoutOverrideEditor } = await import('./tabs/subflow/TimeoutOverrideEditor');
const { AgentDecisionSection } = await import('./tabs/agent/AgentDecisionSection');

const EXPR = { location: 'dynamicExpresso', encoding: 'NAT' as const, code: 'TimeSpan.FromMinutes(15.0)' };

describe('expression slots', () => {
  it('the transition timer is a timer expression slot', () => {
    const html = renderToStaticMarkup(
      createElement(TransitionTimerSection, {
        timer: EXPR,
        stateKey: 's',
        transitionKey: 't',
        index: 0,
        onUpdateScript: () => undefined,
        onRemoveScript: () => undefined,
      }),
    );
    expect(html).toContain('data-csx="timer:timer"');
  });

  it('the subflow timeout override mapping is a timer expression slot', () => {
    const html = renderToStaticMarkup(
      createElement(TimeoutOverrideEditor, {
        timeout: {
          key: 'expired',
          target: 'done',
          versionStrategy: 'Minor',
          timer: { reset: 'never', duration: 'PT1H' },
          mapping: EXPR,
        } as never,
        stateKey: 'child',
        childStateKeys: ['done'],
        onUpdate: () => undefined,
        onClear: () => undefined,
      }),
    );
    expect(html).toMatch(/data-csx="[^"]*mapping:timer"/);
  });

  const agentState = (mode: string) => ({
    key: 'classifying',
    agent: { decision: { mode, fallback: 'failed' } },
    transitions: [
      { key: 'a', target: 'x', triggerType: 1 },
      { key: 'b', target: 'x', triggerType: 1 },
      { key: 'failed', target: 'x', triggerType: 1 },
    ],
  });

  it('the agent decision mapping is a decision expression slot', () => {
    const html = renderToStaticMarkup(
      createElement(AgentDecisionSection, { state: agentState('script'), onEditDecision: () => undefined }),
    );
    expect(html).toContain('data-csx="decision.mapping:decision"');
  });

  it('the agent hints mapping stays C# only', () => {
    const html = renderToStaticMarkup(
      createElement(AgentDecisionSection, { state: agentState('model'), onEditDecision: () => undefined }),
    );
    expect(html).toContain('data-csx="decision.hintsMapping:none"');
  });

  // Both editors read zustand stores and hide the field behind local UI state (a collapsed mapping, the
  // prompt mode), which `renderToStaticMarkup` cannot reach; pin the wiring at the source instead.
  it('the workflow timeout mapping and the agent prompt pass their kinds', () => {
    const timeout = readFileSync(join(__dirname, 'sections', 'WorkflowTimeoutSection.tsx'), 'utf8');
    expect(timeout).toMatch(/templateType="mapping"\s+expressionKind="timer"\s+contextName=\{`timeout-/);
    const prompt = readFileSync(join(__dirname, 'tabs', 'agent', 'AgentStateTab.tsx'), 'utf8');
    expect(prompt).toMatch(/templateType="agentPrompt"\s+expressionKind="string"/);
    expect(prompt).toContain("prompt.location === DYNAMIC_EXPRESSO_LOCATION");
  });
});
