import { describe, expect, it } from 'vitest';
import { setTimeoutAnnotations, setTimeoutComment, type TimeoutFieldHolder } from './timeoutFields';

describe('setTimeoutAnnotations', () => {
  it('writes non-empty annotations', () => {
    const t: TimeoutFieldHolder = {};
    setTimeoutAnnotations(t, { 'ui/countdown': 'root-deadline' });
    expect(t).toEqual({ annotations: { 'ui/countdown': 'root-deadline' } });
  });

  it('drops the key when cleared or emptied', () => {
    const cleared: TimeoutFieldHolder = { annotations: { a: '1' } };
    setTimeoutAnnotations(cleared, undefined);
    expect('annotations' in cleared).toBe(false);

    const emptied: TimeoutFieldHolder = { annotations: { a: '1' } };
    setTimeoutAnnotations(emptied, {});
    expect('annotations' in emptied).toBe(false);
  });
});

describe('setTimeoutComment', () => {
  it('writes the text as typed', () => {
    const t: TimeoutFieldHolder = {};
    setTimeoutComment(t, 'Abandon after 20 seconds ');
    expect(t._comment).toBe('Abandon after 20 seconds ');
  });

  it('drops the key for blank text', () => {
    const t: TimeoutFieldHolder = { _comment: 'old' };
    setTimeoutComment(t, '   ');
    expect('_comment' in t).toBe(false);
  });
});
