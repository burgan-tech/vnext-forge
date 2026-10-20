import { describe, expect, it } from 'vitest';
import type { FileReadRequest } from '@burgan-tech/pseudo-ui';

import { readBrowserFile } from './readBrowserFile';

function request(file: unknown, over: Partial<FileReadRequest> = {}): FileReadRequest {
  return { file, name: 'a.txt', mimeType: 'text/plain', size: 2, field: 'doc', maxSizeBytes: 1024, accept: [], ...over };
}

describe('readBrowserFile', () => {
  it('reads a Blob into base64 without a data: prefix', async () => {
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' });
    await expect(readBrowserFile(request(file))).resolves.toEqual({
      name: 'a.txt',
      mimeType: 'text/plain',
      size: 2,
      content: 'aGk=',
    });
  });

  it('encodes payloads larger than one chunk', async () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 251);
    const out = await readBrowserFile(request(new Blob([bytes]), { size: bytes.length }));
    expect(out?.content).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('returns null when the handle is not a Blob', async () => {
    await expect(readBrowserFile(request({ path: '/x' }))).resolves.toBeNull();
  });
});
