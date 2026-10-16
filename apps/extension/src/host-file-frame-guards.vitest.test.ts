import { describe, expect, it } from 'vitest';

import { isHostBytesFrame, safeFileName } from './host-file-frame-guards';

describe('host file frames', () => {
  it('accepts only complete save/open byte frames', () => {
    const frame = { type: 'host:save-bytes', fileName: 'a.pdf', mimeType: 'application/pdf', contentBase64: 'JVBE' };
    expect(isHostBytesFrame(frame)).toBe(true);
    expect(isHostBytesFrame({ ...frame, type: 'host:open-bytes' })).toBe(true);
    expect(isHostBytesFrame({ ...frame, type: 'host:save-file' })).toBe(false);
    expect(isHostBytesFrame({ ...frame, contentBase64: 1 })).toBe(false);
  });

  it('reduces runtime-supplied names to a safe basename', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\temp\\a<b>.pdf')).toBe('a_b_.pdf');
    expect(safeFileName('..')).toBe('download');
    expect(safeFileName('')).toBe('download');
  });
});
