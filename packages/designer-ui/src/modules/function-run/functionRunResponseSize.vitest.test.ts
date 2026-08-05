import { describe, expect, it } from 'vitest';

import { computeResponseByteSize, formatResponseSize } from './functionRunResponseSize';

describe('computeResponseByteSize', () => {
  it('matches the code-unit length for pure ASCII', () => {
    expect(computeResponseByteSize('hello')).toBe(5);
  });

  it('returns 0 for an empty body', () => {
    expect(computeResponseByteSize('')).toBe(0);
  });

  it('counts UTF-8 bytes, not UTF-16 code units, for a multi-byte character', () => {
    // 'é' is one UTF-16 code unit but two UTF-8 bytes — `.length` alone would
    // report 1, undercounting what actually went over the wire.
    const body = 'é';
    expect(body.length).toBe(1);
    expect(computeResponseByteSize(body)).toBe(2);
  });

  it('counts a surrogate-pair emoji as four UTF-8 bytes, not two code units', () => {
    const body = '🚀';
    expect(body.length).toBe(2);
    expect(computeResponseByteSize(body)).toBe(4);
  });

  it('counts a realistic JSON body correctly', () => {
    const body = '{"name":"café"}';
    // 15 ASCII chars + 1 extra byte for the 'é' (2 bytes instead of 1).
    expect(computeResponseByteSize(body)).toBe(body.length + 1);
  });
});

describe('formatResponseSize', () => {
  it('shows a plain integer with a B suffix below 1 KB', () => {
    expect(formatResponseSize(0)).toBe('0 B');
    expect(formatResponseSize(500)).toBe('500 B');
    expect(formatResponseSize(1023)).toBe('1023 B');
  });

  it('switches to KB with one decimal at exactly 1024 bytes', () => {
    expect(formatResponseSize(1024)).toBe('1.0 KB');
  });

  it('formats a fractional KB value', () => {
    expect(formatResponseSize(1536)).toBe('1.5 KB');
  });

  it('switches to MB with one decimal at exactly 1 MiB', () => {
    expect(formatResponseSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('formats a fractional MB value', () => {
    expect(formatResponseSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('stays under the MB threshold for one byte less than 1 MiB', () => {
    expect(formatResponseSize(1024 * 1024 - 1)).toBe('1024.0 KB');
  });
});
