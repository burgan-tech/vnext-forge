import { afterEach, describe, expect, it, vi } from 'vitest';

import { runWfCaptured, type WfExecFileFn } from './wf-captured-run.js';

type ExecError = Parameters<Parameters<WfExecFileFn>[3]>[0];

function fakeExec(error: ExecError, stdout = '', stderr = '') {
  return vi.fn<WfExecFileFn>((_file, _args, _options, callback) => callback(error, stdout, stderr));
}

afterEach(() => {
  delete process.env.VNEXT_FORGE_TEST_SECRET;
});

describe('runWfCaptured', () => {
  it('runs wf with the argv, cwd, timeout and an allowlisted env', async () => {
    process.env.VNEXT_FORGE_TEST_SECRET = 'leak';
    const exec = fakeExec(null, '  ✓ Generated 1 SQL file(s): /ws/index-sql/b\n');
    const result = await runWfCaptured(['indexes', 'generate'], { cwd: '/ws', timeoutMs: 1000 }, exec);
    expect(result).toEqual({ exitCode: 0, stdout: '  ✓ Generated 1 SQL file(s): /ws/index-sql/b\n', stderr: '' });
    const [file, args, options] = exec.mock.calls[0];
    expect(file).toBe('wf');
    expect(args).toEqual(['indexes', 'generate']);
    expect(options.cwd).toBe('/ws');
    expect(options.timeout).toBe(1000);
    expect(options.shell).toBe(process.platform === 'win32');
    expect(options.env.VNEXT_FORGE_TEST_SECRET).toBeUndefined();
    expect(options.env.PATH).toBe(process.env.PATH);
  });

  it('resolves a non-zero exit with the captured output', async () => {
    const error = Object.assign(new Error('Command failed'), { code: 1 });
    const result = await runWfCaptured(['indexes', 'generate'], { cwd: '/ws', timeoutMs: 1000 }, fakeExec(error, '  ✗ boom\n'));
    expect(result).toEqual({ exitCode: 1, stdout: '  ✗ boom\n', stderr: '' });
  });

  it('explains a missing binary', async () => {
    const error = Object.assign(new Error('spawn wf ENOENT'), { code: 'ENOENT' });
    const result = await runWfCaptured(['indexes', 'generate'], { cwd: '/ws', timeoutMs: 1000 }, fakeExec(error));
    expect(result).toEqual({
      exitCode: null,
      stdout: '',
      stderr: '',
      errorMessage: 'The Workflow CLI (wf) was not found on PATH.',
    });
  });

  it('explains a timeout', async () => {
    const error = Object.assign(new Error('killed'), { code: null, killed: true });
    const result = await runWfCaptured(['indexes', 'generate'], { cwd: '/ws', timeoutMs: 300_000 }, fakeExec(error));
    expect(result.exitCode).toBeNull();
    expect(result.errorMessage).toBe('The Workflow CLI did not finish within 300s.');
  });
});
