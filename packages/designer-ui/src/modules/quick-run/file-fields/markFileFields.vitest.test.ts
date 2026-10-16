import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { isActiveContentType } from './fileHostActions';
import { FileUploadField } from './FileUploadField';
import { FILE_FIELD_MARKER, markFileFields } from './markFileFields';

const transitionSchema = {
  type: 'object',
  properties: {
    identityDocument: { type: 'object', properties: { name: { type: 'string' }, mimeType: { type: 'string' } } },
    attachments: { type: 'array', items: { type: 'object', properties: { name: {}, content: {} } } },
    note: { type: 'string' },
  },
};

describe('markFileFields', () => {
  it('marks master x-storage paths and upload-shaped nodes without touching the input', () => {
    const marked = markFileFields(transitionSchema, ['identityDocument']) as typeof transitionSchema & {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(marked.properties.identityDocument![FILE_FIELD_MARKER]).toBe(true);
    expect((marked.properties.attachments!.items as Record<string, unknown>)[FILE_FIELD_MARKER]).toBe(true);
    expect(marked.properties.note![FILE_FIELD_MARKER]).toBeUndefined();
    expect((transitionSchema.properties.identityDocument as Record<string, unknown>)[FILE_FIELD_MARKER]).toBeUndefined();
  });

  it('returns the same schema when there is nothing to mark', () => {
    const plain = { type: 'object', properties: { a: { type: 'string' } } };
    expect(markFileFields(plain, [])).toBe(plain);
    expect(markFileFields(null, ['x'])).toBeNull();
  });
});

describe('FileUploadField', () => {
  const render = (value: unknown) => renderToStaticMarkup(createElement(FileUploadField, { value, onChange: () => undefined }));

  it('offers a picker when empty, the upload when picked, the kept file for a handle', () => {
    expect(render(undefined)).toContain('Choose file…');
    const picked = render({ name: 'a.pdf', mimeType: 'application/pdf', size: 2048, content: 'JVBE' });
    expect(picked).toContain('a.pdf');
    expect(picked).toContain('uploads with this request');
    expect(render({ file: 'f-1', name: 'kept.pdf', eTag: 'e' })).toContain('Keeps the stored file');
  });
});

describe('isActiveContentType', () => {
  it('flags types a browser would run', () => {
    expect(isActiveContentType('text/html; charset=utf-8')).toBe(true);
    expect(isActiveContentType('image/svg+xml')).toBe(true);
    expect(isActiveContentType('application/pdf')).toBe(false);
  });
});

describe('stripFileFieldValues', () => {
  it('drops generated values in file fields and file arrays, keeps the rest', async () => {
    const { stripFileFieldValues } = await import('./markFileFields');
    const marked = markFileFields(transitionSchema, ['identityDocument']);
    const generated = {
      identityDocument: { name: 'x', size: -3, content: 'zz' },
      attachments: [{ name: 'y', content: 'q' }],
      note: 'kept',
    };
    expect(stripFileFieldValues(generated, marked)).toEqual({ note: 'kept' });
  });
});
