import { describe, expect, it, vi } from 'vitest';

import { WF_CLI_NOT_INSTALLED, WfCliProbe, type ExecVersionFn } from './wf-cli-probe.js';

const resolves = (out: string): ExecVersionFn => () => Promise.resolve(out);

describe('WfCliProbe', () => {
  it('parses the version and every capability', async () => {
    expect(await new WfCliProbe(resolves('1.1.0\n')).get()).toEqual({
      installed: true,
      version: '1.1.0',
      supportsDomainFlag: true,
      supportsIndexes: true,
      supportsPublishCompleted: true,
    });
    expect(await new WfCliProbe(resolves('1.0.14')).get()).toEqual({
      installed: true,
      version: '1.0.14',
      supportsDomainFlag: true,
      supportsIndexes: true,
      supportsPublishCompleted: true,
    });
    expect(await new WfCliProbe(resolves('1.0.13')).get()).toEqual({
      installed: true,
      version: '1.0.13',
      supportsDomainFlag: true,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    });
    expect(await new WfCliProbe(resolves('1.0.12')).get()).toEqual({
      installed: true,
      version: '1.0.12',
      supportsDomainFlag: false,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    });
  });

  it('memoizes a successful probe until invalidated', async () => {
    const exec = vi.fn<ExecVersionFn>(resolves('1.0.13'));
    const probe = new WfCliProbe(exec);
    await probe.get();
    await probe.get();
    expect(exec).toHaveBeenCalledTimes(1);
    probe.invalidate();
    await probe.get();
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('reports a missing CLI and re-probes next time', async () => {
    const exec = vi.fn<ExecVersionFn>(() => Promise.reject(new Error('ENOENT')));
    const probe = new WfCliProbe(exec);
    expect(await probe.get()).toEqual(WF_CLI_NOT_INSTALLED);
    expect(WF_CLI_NOT_INSTALLED).toEqual({
      installed: false,
      supportsDomainFlag: false,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    });
    exec.mockImplementationOnce(resolves('1.1.0'));
    expect((await probe.get()).supportsIndexes).toBe(true);
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('keeps an unparsable version string but treats it as legacy', async () => {
    expect(await new WfCliProbe(resolves('dev-build')).get()).toEqual({
      installed: true,
      version: 'dev-build',
      supportsDomainFlag: false,
      supportsIndexes: false,
      supportsPublishCompleted: false,
    });
  });

  it('notifies invalidate listeners until they are disposed', () => {
    const probe = new WfCliProbe(resolves('1.1.0'));
    const listener = vi.fn();
    const subscription = probe.onDidInvalidate(listener);
    probe.invalidate();
    expect(listener).toHaveBeenCalledTimes(1);
    subscription.dispose();
    probe.invalidate();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
