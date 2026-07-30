import { describe, expect, it } from 'vitest';

import { mergeQuickRunHeaders } from './mergeQuickRunHeaders';
import type { WorkflowBucketConfig } from '../QuickRunApi';

function makeConfig(globalHeaders: Record<string, string>): WorkflowBucketConfig {
  return {
    key: 'wf-1',
    globalHeaders,
    start: { headers: {}, queryStrings: {}, body: { attributes: {} } },
    transitions: [],
  };
}

describe('mergeQuickRunHeaders', () => {
  it('returns global headers when there are no session headers', () => {
    expect(mergeQuickRunHeaders(makeConfig({ 'X-Global': 'gv' }), undefined)).toEqual({
      'X-Global': 'gv',
    });
  });

  it('returns session headers when bucketConfig is null', () => {
    expect(mergeQuickRunHeaders(null, { 'X-Session': 'sv' })).toEqual({ 'X-Session': 'sv' });
  });

  it('returns an empty object when everything is absent', () => {
    expect(mergeQuickRunHeaders(undefined, undefined)).toEqual({});
  });

  it('merges both, with session winning on conflict', () => {
    const merged = mergeQuickRunHeaders(
      makeConfig({ 'X-Common': 'global', 'X-Global': 'gv' }),
      { 'X-Common': 'session', 'X-Session': 'sv' },
    );
    expect(merged).toEqual({ 'X-Common': 'session', 'X-Global': 'gv', 'X-Session': 'sv' });
  });

  it('lets extra headers win over both', () => {
    const merged = mergeQuickRunHeaders(
      makeConfig({ 'X-Common': 'global' }),
      { 'X-Common': 'session' },
      { 'X-Common': 'extra', 'X-Extra': 'ev' },
    );
    expect(merged).toEqual({ 'X-Common': 'extra', 'X-Extra': 'ev' });
  });

  it('does not mutate its inputs', () => {
    const cfg = makeConfig({ 'X-Global': 'gv' });
    const session = { 'X-Session': 'sv' };
    mergeQuickRunHeaders(cfg, session, { 'X-Extra': 'ev' });
    expect(cfg.globalHeaders).toEqual({ 'X-Global': 'gv' });
    expect(session).toEqual({ 'X-Session': 'sv' });
  });
});
