import { describe, expect, it, vi } from 'vitest';

import { WfCliProbe, type ExecVersionFn } from './wf-cli-probe.js';

const resolves = (out: string): ExecVersionFn => () => Promise.resolve(out);

describe('WfCliProbe', () => {
  it('parses the version and the --domain capability', async () => {
    const probe = new WfCliProbe(resolves('1.0.13\n'));
    expect(await probe.get()).toEqual({ installed: true, version: '1.0.13', supportsDomainFlag: true });
    const old = new WfCliProbe(resolves('1.0.12'));
    expect(await old.get()).toEqual({ installed: true, version: '1.0.12', supportsDomainFlag: false });
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
    expect(await probe.get()).toEqual({ installed: false, supportsDomainFlag: false });
    exec.mockImplementationOnce(resolves('1.0.13'));
    expect(await probe.get()).toEqual({ installed: true, version: '1.0.13', supportsDomainFlag: true });
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it('keeps an unparsable version string but treats it as legacy', async () => {
    const probe = new WfCliProbe(resolves('dev-build'));
    expect(await probe.get()).toEqual({ installed: true, version: 'dev-build', supportsDomainFlag: false });
  });
});
