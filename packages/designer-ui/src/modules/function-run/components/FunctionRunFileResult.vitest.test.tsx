import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunFileResult } from './FunctionRunFileResult';

const render = (props: Parameters<typeof FunctionRunFileResult>[0]) =>
  renderToStaticMarkup(createElement(FunctionRunFileResult, props));

describe('FunctionRunFileResult', () => {
  it('shows the file metadata with Open and Save as', () => {
    const html = render({
      response: { contentBase64: 'JVBE', contentType: 'application/pdf', size: 2048, fileName: 'id.pdf', eTag: 'e-1' },
      fileId: 'f-1',
      durationMs: 12.4,
    });
    expect(html).toContain('id.pdf');
    expect(html).toContain('2.0 KB');
    expect(html).toContain('application/pdf');
    expect(html).toContain('e-1');
    expect(html).toContain('12 ms');
    expect(html).toContain('>Open<');
    expect(html).toContain('Save as…');
  });

  it('falls back to the file id and a dash for a missing ETag', () => {
    const html = render({
      response: { contentBase64: '', contentType: '', size: 0 },
      fileId: 'f-1',
      durationMs: null,
    });
    expect(html).toContain('f-1');
    expect(html).toContain('application/octet-stream');
    expect(html).toContain('—');
  });
});
