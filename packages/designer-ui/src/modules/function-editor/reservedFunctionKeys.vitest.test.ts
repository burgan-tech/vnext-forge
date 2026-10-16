import { describe, expect, it } from 'vitest';

import { reservedFunctionKeyWarning } from './reservedFunctionKeys';

describe('reservedFunctionKeyWarning', () => {
  it('flags system function keys, including file (runtime 0.0.100)', () => {
    expect(reservedFunctionKeyWarning('file')).toContain('built-in system function');
    expect(reservedFunctionKeyWarning(' Data ')).toContain('…/functions/data');
    expect(reservedFunctionKeyWarning('human-task')).toContain('domain route');
  });

  it('accepts other keys', () => {
    expect(reservedFunctionKeyWarning('get-customer')).toBeNull();
    expect(reservedFunctionKeyWarning('files')).toBeNull();
  });
});
