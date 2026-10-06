import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CodePreview, ResourceRef } from '../components/panels/tabs/PropertyPanelShared';
import { ComponentLinkProvider, type ComponentLinkHandlers } from './ComponentLinkContext';
import { StateInspector } from './StateInspector';
import type { StateView } from './view-types';

const REF = { key: 'approve-view', domain: 'core', version: '1.0.0', flow: 'sys-views' };

const withLinks = (value: ComponentLinkHandlers, child: ReturnType<typeof h>) =>
  renderToStaticMarkup(h(ComponentLinkProvider, { value, children: child }));

describe('ResourceRef links', () => {
  it('renders no open button without a provider', () => {
    expect(renderToStaticMarkup(h(ResourceRef, { resource: REF, category: 'views' }))).not.toContain('Open approve-view');
  });

  it('offers to open a resolved reference', () => {
    const html = withLinks(
      { resolveComponent: () => '/ws/core/Views/approve-view.json', openComponent: () => {} },
      h(ResourceRef, { resource: REF, category: 'views' }),
    );
    expect(html).toContain('Open approve-view in its designer');
    expect(html).not.toMatch(/<button[^>]*\sdisabled(=|\s|>)/);
  });

  it('disables the button for a reference outside the workspace', () => {
    const html = withLinks(
      { resolveComponent: () => null, openComponent: () => {} },
      h(ResourceRef, { resource: REF, category: 'views' }),
    );
    expect(html).toContain('Not in this workspace');
    expect(html).toMatch(/<button[^>]*\sdisabled(=|\s|>)/);
  });

  it('needs a category to link', () => {
    const html = withLinks({ openComponent: () => {} }, h(ResourceRef, { resource: REF }));
    expect(html).not.toContain('in its designer');
  });
});

describe('CodePreview script link', () => {
  it('offers to open the script file', () => {
    const html = withLinks({ openScript: () => {} }, h(CodePreview, { code: '', location: './src/Gate.csx' }));
    expect(html).toContain('Open script');
  });

  it('shows no script button without openScript', () => {
    expect(renderToStaticMarkup(h(CodePreview, { code: '', location: './src/Gate.csx' }))).not.toContain('Open script');
  });
});

describe('StateInspector summary slot', () => {
  it('renders the summary under the header', () => {
    const html = renderToStaticMarkup(
      h(StateInspector, { state: { key: 's1', stateType: 2, transitions: [] } as StateView, summary: 'Visited 2× · now here' }),
    );
    expect(html).toContain('Visited 2× · now here');
  });
});
