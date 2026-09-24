import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StateInteraction } from '@vnext-forge-studio/vnext-types';

vi.mock('../../../../../../modules/save-component/components/CsxEditorField', () => ({
  CsxEditorField: (props: { templateType: string; listField: string; scriptField: string }) =>
    createElement('div', { 'data-csx': `${props.templateType}:${props.listField}:${props.scriptField}` }),
}));
vi.mock('../../../../../../modules/save-component/components/MappingScriptsSection', () => ({
  MappingScriptsSection: () => null,
}));

const { StateInteractionEditor } = await import('./StateInteractionEditor');

const RULE = { location: './src/InteractionGate.csx', code: 'cmV0dXJuIHRydWU7' };

function render(interaction: StateInteraction | null): string {
  return renderToStaticMarkup(
    createElement(StateInteractionEditor, { interaction, stateKey: 'lp-wait', onChange: () => undefined }),
  );
}

describe('StateInteractionEditor', () => {
  it('shows the Roles arm selected with the role editor', () => {
    const html = render({ longPoll: { terminate: true, roles: [{ role: 'ovr.child-ack', grant: 'allow' }] } });
    expect(html).toMatch(/aria-pressed="true"[^>]*>Roles<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Rule<\/button>/);
    expect(html).toContain('value="ovr.child-ack"');
    expect(html).not.toContain('data-csx');
  });

  it('shows the Rule arm with a condition script bound to interaction.longPoll.rule', () => {
    const html = render({ longPoll: { terminate: true, rule: RULE } });
    expect(html).toMatch(/aria-pressed="true"[^>]*>Rule<\/button>/);
    expect(html).toContain('data-csx="condition:interaction:longPoll.rule"');
    expect(html).not.toContain('e.g. morph-idm.maker');
  });

  it('warns when both arms are present', () => {
    const html = render({
      longPoll: { terminate: true, roles: [], rule: RULE } as unknown as StateInteraction['longPoll'],
    });
    expect(html).toContain('Both roles and a rule are set');
  });

  it('warns when the rule has no script yet', () => {
    const html = render({ longPoll: { terminate: true, rule: { location: '', code: '' } } });
    expect(html).toContain('No authorization is set');
  });

  it('offers to add a long poll when there is none', () => {
    expect(render(null)).toContain('Add long poll');
  });
});
