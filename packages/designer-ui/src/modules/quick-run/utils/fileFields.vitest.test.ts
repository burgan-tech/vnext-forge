import { describe, expect, it } from 'vitest';

import {
  base64ToBytes,
  bytesToBase64,
  collectFileHandles,
  isFileHandle,
  isFileUploadNode,
  storageFieldPaths,
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
