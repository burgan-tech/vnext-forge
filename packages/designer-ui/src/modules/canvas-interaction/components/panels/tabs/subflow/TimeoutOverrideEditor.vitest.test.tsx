import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TimeoutTransition } from '@vnext-forge-studio/vnext-types';

vi.mock('../../../../../../modules/save-component/components/CsxEditorField', () => ({
  CsxEditorField: (props: { templateType: string; listField: string; scriptField: string }) =>
    createElement('div', { 'data-csx': `${props.templateType}:${props.listField}:${props.scriptField}` }),
}));
vi.mock('../../../../../../modules/save-component/components/MappingScriptsSection', () => ({
  MappingScriptsSection: () => null,
}));

const { TimeoutOverrideEditor } = await import('./TimeoutOverrideEditor');

function render(timeout: TimeoutTransition | undefined, childStateKeys: string[] = []): string {
  return renderToStaticMarkup(
    createElement(TimeoutOverrideEditor, {
      timeout,
      stateKey: 'parent-subflow',
      childStateKeys,
      onUpdate: () => undefined,
      onClear: () => undefined,
    }),
  );
}

const TIMEOUT: TimeoutTransition = {
  key: 'child-abandoned',
  target: 'child-timedout',
  versionStrategy: 'Minor',
  timer: { reset: 'never', duration: 'PT20S' },
  annotations: { 'ui/countdown': 'parent-override' },
  _comment: 'Parent deadline for the child',
};

describe('TimeoutOverrideEditor', () => {
  it('offers child states as timeout targets and keeps the current target', () => {
    const html = render(TIMEOUT, ['child-waiting', 'child-completed', 'child-timedout']);
    expect(html).toContain('value="child-timedout"');
    expect(html).toContain('value="child-waiting"');
    expect(html).toContain('<datalist');
  });

  it('edits annotations, description and the mapping script', () => {
    const html = render(TIMEOUT);
    expect(html).toContain('Annotations');
    expect(html).toContain('value="ui/countdown"');
    expect(html).toContain('Parent deadline for the child');
    expect(html).toContain('data-csx="mapping:subFlow:overrides.timeout.mapping"');
  });

  it('starts collapsed when nothing is set', () => {
    const html = render(undefined);
    expect(html).toContain('Timeout override');
    expect(html).toContain('Not set');
    expect(html).not.toContain('data-csx');
  });

  it('shows an inline note that the runtime ignores timer.reset', () => {
    const html = render(TIMEOUT);
    expect(html).toContain('The runtime does not read reset yet');
  });

  it('shows Incomplete (not Configured/Not set) for a key-less override, and still offers Clear', () => {
    const html = render({ key: '', target: 'child-timedout' });
    expect(html).toContain('Incomplete');
    expect(html).not.toContain('>Configured<');
    expect(html).not.toContain('>Not set<');
    expect(html).toContain('Clear timeout override');
  });

  it('treats a fully-set override as Configured', () => {
    const html = render(TIMEOUT);
    expect(html).toContain('Configured');
    expect(html).not.toContain('Incomplete');
  });
});
