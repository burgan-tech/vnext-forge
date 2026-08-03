import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ComponentDescriptionField } from './ComponentDescriptionField.js';
import { FormReadOnlyProvider } from './FormReadOnlyContext.js';
import { Input } from './Input.js';
import { KVEditor } from './KeyValueEditor.js';
import { TagEditor } from './TagEditor.js';
import { Select } from './Select.js';
import { Textarea } from './Textarea.js';

const noop = () => undefined;

describe('FormReadOnlyContext', () => {
  it('defaults to editable without a provider', () => {
    const html = renderToStaticMarkup(
      h(KVEditor, { pairs: [{ key: 'a', value: 'b' }], onChange: noop }),
    );
    expect(html).toContain('Add'); // add button present
  });

  it('makes Input readOnly inside the provider', () => {
    const html = renderToStaticMarkup(
      h(FormReadOnlyProvider, null, h(Input, { value: 'x', onChange: noop })),
    );
    // React 19 SSR emits the attribute as `readOnly=""` (HTML attribute names
    // are case-insensitive), so match case-insensitively.
    expect(html.toLowerCase()).toContain('readonly');
  });

  it('hides KVEditor and TagEditor action buttons inside the provider', () => {
    const html = renderToStaticMarkup(
      h(
        FormReadOnlyProvider,
        null,
        h(KVEditor, { pairs: [{ key: 'a', value: 'b' }], onChange: noop }),
        h(TagEditor, { tags: ['t1'], onChange: noop }),
      ),
    );
    expect(html).not.toContain('aria-label="Remove row 1"');
    expect(html).not.toContain('aria-label="Remove t1"');
    expect(html).not.toContain('data-slot="tag-editor-input"');
  });

  it('renders Select non-interactive inside the provider', () => {
    const html = renderToStaticMarkup(
      h(
        FormReadOnlyProvider,
        null,
        h(Select, { value: 'GET', onChange: noop }, h('option', { value: 'GET' }, 'GET')),
      ),
    );
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('aria-readonly="true"');
  });

  it('makes Textarea readOnly with quiet classes inside the provider', () => {
    const html = renderToStaticMarkup(
      h(FormReadOnlyProvider, null, h(Textarea, { value: 'x', onChange: noop })),
    );
    // React 19 SSR emits the attribute as `readOnly=""` (HTML attribute names
    // are case-insensitive), so match case-insensitively.
    expect(html.toLowerCase()).toContain('readonly');
    expect(html).toContain('focus-visible:ring-0');
    expect(html).toContain('cursor-default');
  });

  it('makes ComponentDescriptionField readOnly inside the provider', () => {
    const html = renderToStaticMarkup(
      h(FormReadOnlyProvider, null, h(ComponentDescriptionField, { value: 'x', onChange: noop })),
    );
    expect(html.toLowerCase()).toContain('readonly');
  });

  it('explicit prop still wins over context', () => {
    const html = renderToStaticMarkup(
      h(
        FormReadOnlyProvider,
        null,
        h(KVEditor, { pairs: [{ key: 'a', value: 'b' }], onChange: noop, readOnly: false }),
      ),
    );
    expect(html).toContain('Add');
  });
});
