import { describe, expect, it } from 'vitest';
import { nextRowSecurity, parseRowFilter } from './WorkflowRowSecuritySection';

describe('WorkflowRowSecuritySection helpers', () => {
  it('drops rowSecurity entirely when the last rule is removed', () => {
    expect(nextRowSecurity([])).toBeUndefined();
    expect(nextRowSecurity([{ roles: ['hq-auditor'] }])).toEqual({ rules: [{ roles: ['hq-auditor'] }] });
  });

  it('treats a blank filter as "no filter" and only accepts one JSON object', () => {
    expect(parseRowFilter('  ')).toEqual({});
    expect(parseRowFilter('{"status":{"eq":"A"}}')).toEqual({ filter: { status: { eq: 'A' } } });
    expect(parseRowFilter('[1]').error).toMatch(/single JSON object/);
    expect(parseRowFilter('{}').error).toMatch(/empty/);
    expect(parseRowFilter('{').error).toMatch(/not valid JSON/);
  });
});
