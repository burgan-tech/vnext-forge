import { describe, expect, it } from 'vitest';

import { QUICKRUN_LAYOUT_DEFAULTS, QUICKRUN_LAYOUT_KEY } from './hooks/quickRunLayout';
import { useQuickRunStore } from './store/quickRunStore';

describe('Quick Run panel layout', () => {
  it('declares persisted defaults for both panels', () => {
    expect(QUICKRUN_LAYOUT_KEY).toBe('vnext-forge.quickrun.layout');
    expect(QUICKRUN_LAYOUT_DEFAULTS.left).toEqual({ size: 220, open: true, min: 160, max: 400 });
    expect(QUICKRUN_LAYOUT_DEFAULTS.right).toEqual({ size: 320, open: true, min: 200, max: 560 });
  });

  it('bumps the reveal counter on every setContextPanelTab call, even for the same tab', () => {
    const before = useQuickRunStore.getState().contextPanelReveal;
    useQuickRunStore.getState().setContextPanelTab('history');
    useQuickRunStore.getState().setContextPanelTab('history');
    expect(useQuickRunStore.getState().contextPanelTab).toBe('history');
    expect(useQuickRunStore.getState().contextPanelReveal).toBe(before + 2);
  });
});
