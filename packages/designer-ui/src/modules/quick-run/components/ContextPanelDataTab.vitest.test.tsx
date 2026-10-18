import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CorrelationInfo, DataResponse } from '../types/quickrun.types';
import type { DataTarget } from '../utils/dataTarget';

// `CopyableJsonBlock` mounts Monaco, which needs a DOM this package's
// SSR-only harness does not have.
vi.mock('./CopyableJsonBlock', () => ({
  CopyableJsonBlock: ({ value }: { value: unknown }) => createElement('pre', null, JSON.stringify(value)),
}));
vi.mock('../QuickRunApi', () => ({ getData: vi.fn() }));

const QuickRunApi = await import('../QuickRunApi');
const { useQuickRunStore } = await import('../store/quickRunStore');
const { DataTabView, loadMainInstanceData } = await import('./ContextPanel.js');

const getData = QuickRunApi.getData as unknown as ReturnType<typeof vi.fn>;

const via: CorrelationInfo = {
  correlationId: 'corr-1',
  parentState: 'kyc',
  subFlowInstanceId: 'abcdef1234567890',
  subFlowType: 'S',
  subFlowDomain: 'kyc',
  subFlowName: 'kyc-child',
  subFlowVersion: '1.0.0',
  isCompleted: false,
};
const childTarget: DataTarget = { domain: 'kyc', workflowKey: 'kyc-child', instanceId: 'abcdef1234567890', via };
const ownTarget: DataTarget = { domain: 'core', workflowKey: 'parent', instanceId: 'parent-1', via: null };

const childData: DataResponse = { data: { owner: 'child-value' } };
const parentData: DataResponse = { data: { owner: 'parent-value' } };

const baseProps = {
  data: childData,
  loading: false,
  historyNone: false,
  fileContext: undefined,
  mainData: null,
  mainLoading: false,
  onSourceChange: () => undefined,
};

describe('ContextPanel — Data tab', () => {
  beforeEach(() => getData.mockReset());

  it('names the active sub-flow', () => {
    const html = renderToStaticMarkup(createElement(DataTabView, { ...baseProps, target: childTarget, source: 'active' }));
    expect(html).toContain('Active sub-flow: kyc-child · abcdef12');
    expect(html).toContain('Active flow');
    expect(html).toContain('Main instance');
    expect(html).toContain('child-value');
  });

  it('shows no header and no switch without an open sub-flow', () => {
    const html = renderToStaticMarkup(createElement(DataTabView, { ...baseProps, target: ownTarget, source: 'active' }));
    expect(html).not.toContain('Active sub-flow');
    expect(html).not.toContain('Main instance');
    expect(html).toContain('child-value');
  });

  it('switches to the main instance without touching activeData', async () => {
    useQuickRunStore.setState({ activeData: childData, etags: { data: 'etag-child' } });
    getData.mockResolvedValueOnce({ success: true, data: parentData });

    const loaded = await loadMainInstanceData({ domain: 'core', workflowKey: 'parent', instanceId: 'parent-1' });

    expect(loaded).toEqual(parentData);
    const call = getData.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).toMatchObject({ domain: 'core', workflowKey: 'parent', instanceId: 'parent-1' });
    expect(call.ifNoneMatch).toBeUndefined();
    expect(useQuickRunStore.getState().activeData).toBe(childData);
    expect(useQuickRunStore.getState().etags.data).toBe('etag-child');

    const html = renderToStaticMarkup(
      createElement(DataTabView, { ...baseProps, target: childTarget, source: 'main', mainData: loaded }),
    );
    expect(html).toContain('parent-value');
    expect(html).not.toContain('child-value');
  });

  it('returns null for a failed or thrown main-instance load', async () => {
    getData.mockResolvedValueOnce({ success: false, error: { code: 'X', message: 'boom' } });
    expect(await loadMainInstanceData({ domain: 'core', workflowKey: 'parent', instanceId: 'parent-1' })).toBeNull();
    getData.mockRejectedValueOnce(new Error('offline'));
    expect(await loadMainInstanceData({ domain: 'core', workflowKey: 'parent', instanceId: 'parent-1' })).toBeNull();
  });
});
