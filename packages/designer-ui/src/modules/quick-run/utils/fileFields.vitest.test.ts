import { describe, expect, it } from 'vitest';

import {
  base64ToBytes,
  bytesToBase64,
  collectFileHandles,
  isFileHandle,
  isFileUploadNode,
  MAX_STREAM_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  chooseUploadRoute,
  storageFieldPaths,
  storageFieldTransports,
  toSchemaPath,
} from './fileFields';

const master = {
  type: 'object',
  properties: {
    identityDocument: { type: 'object', 'x-storage': { binding: 'b' } },
    files: { type: 'array', items: { type: 'object', 'x-storage': { binding: 'b' } } },
    documents: { type: 'array', items: { type: 'object', properties: { doc: { type: 'object', 'x-storage': { binding: 'b' } } } } },
    name: { type: 'string' },
  },
};

const handle = {
  component: 'vnext-blob-local',
  file: '7c9e4c2a',
  name: 'passport.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  eTag: 'abc',
  owner: { domain: 'core', flow: 'kyc', instance: 'i1' },
};

describe('file fields', () => {
  it('lists the master schema file paths', () => {
    expect(storageFieldPaths(master)).toEqual(['identityDocument', 'files[]', 'documents[].doc']);
  });

  it('maps form paths to schema paths', () => {
    expect(toSchemaPath('documents.2.doc')).toBe('documents[].doc');
    expect(toSchemaPath('files.0')).toBe('files[]');
  });

  it('detects uploads by master path or by shape', () => {
    const paths = storageFieldPaths(master);
    expect(isFileUploadNode({ type: 'object' }, 'files.1', paths)).toBe(true);
    expect(isFileUploadNode({ type: 'object', properties: { name: {}, content: {} } }, 'other', [])).toBe(true);
    expect(isFileUploadNode({ type: 'string' }, 'identityDocument', paths)).toBe(false);
    expect(isFileUploadNode({ type: 'object', properties: { a: {} } }, 'other', paths)).toBe(false);
  });

  it('recognises stored handles and finds them in data', () => {
    expect(isFileHandle(handle)).toBe(true);
    expect(isFileHandle({ file: 'x', content: 'abc' })).toBe(false);
    expect(collectFileHandles({ identityDocument: handle, files: [handle], name: 'n' }).map((h) => h.path)).toEqual([
      'identityDocument',
      'files.0',
    ]);
  });

  it('round-trips base64', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 256);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('streamed transports (runtime 0.0.102)', () => {
  const streaming = {
    type: 'object',
    properties: {
      passport: { type: 'object', 'x-storage': { binding: 'b', transport: 'stream' } },
      files: { type: 'array', items: { type: 'object', 'x-storage': { binding: 'b', transport: 'any' } } },
      inline: { type: 'object', 'x-storage': { binding: 'b', transport: 'inline' } },
      plain: { type: 'object', 'x-storage': { binding: 'b' } },
    },
  };

  it('lists only the non-inline transports by schema path', () => {
    expect(storageFieldTransports(streaming)).toEqual({ passport: 'stream', 'files[]': 'any' });
  });

  it('routes a file by transport and size', () => {
    expect(chooseUploadRoute('inline', 10)).toEqual({ route: 'inline' });
    expect(chooseUploadRoute('inline', MAX_UPLOAD_BYTES + 1)).toEqual({ route: 'too-large', limit: MAX_UPLOAD_BYTES });
    expect(chooseUploadRoute('stream', 10)).toEqual({ route: 'stream' });
    expect(chooseUploadRoute('any', 10)).toEqual({ route: 'inline' });
    expect(chooseUploadRoute('any', MAX_UPLOAD_BYTES + 1)).toEqual({ route: 'stream' });
    expect(chooseUploadRoute('stream', MAX_STREAM_UPLOAD_BYTES + 1)).toEqual({
      route: 'too-large',
      limit: MAX_STREAM_UPLOAD_BYTES,
    });
  });
});
