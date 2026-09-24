import { afterEach, describe, expect, it, vi } from 'vitest';

import { runWfCaptured, type WfExecFileFn } from './wf-captured-run.js';

type ExecError = Parameters<Parameters<WfExecFileFn>[3]>[0];

function fakeExec(error: ExecError, stdout = '', stderr = '') {
  return vi.fn<WfExecFileFn>((_file, _args, _options, callback) => callback(error, stdout, stderr));
}

const originalPlatform = process.platform;

function setPlatform(value: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value, configurable: true });
}

afterEach(() => {
  delete process.env.VNEXT_FORGE_TEST_SECRET;
  setPlatform(originalPlatform);
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

  it('includes stderr in the error message on a non-zero exit', async () => {
    const error = Object.assign(new Error('Command failed'), { code: 1 });
    const result = await runWfCaptured(
      ['indexes', 'generate'],
      { cwd: '/ws', timeoutMs: 1000 },
      fakeExec(error, '', "'wf' is not recognized as an internal or external command.\n"),
    );
    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: "'wf' is not recognized as an internal or external command.\n",
      errorMessage: "'wf' is not recognized as an internal or external command.",
    });
  });

  it('rejects an unsafe argv token on win32 without spawning', async () => {
    setPlatform('win32');
    const exec = fakeExec(null, 'should not run');
    const result = await runWfCaptured(['indexes', 'generate', '--flow', 'a b'], { cwd: '/ws', timeoutMs: 1000 }, exec);
    expect(exec).not.toHaveBeenCalled();
    expect(result).toEqual({
      exitCode: null,
      stdout: '',
      stderr: '',
      errorMessage: '"a b" is not a safe argument to pass to the Workflow CLI on Windows.',
    });
  });

  it('rejects a token containing "%" on win32 without spawning (cmd.exe variable expansion)', async () => {
    setPlatform('win32');
    const exec = fakeExec(null, 'should not run');
    const result = await runWfCaptured(['indexes', 'generate', '--flow', 'a%b'], { cwd: '/ws', timeoutMs: 1000 }, exec);
    expect(exec).not.toHaveBeenCalled();
    expect(result).toEqual({
      exitCode: null,
      stdout: '',
      stderr: '',
      errorMessage: '"a%b" is not a safe argument to pass to the Workflow CLI on Windows.',
    });
  });

  it('accepts a token containing "%" on posix (shell: false, no cmd.exe tokenizer)', async () => {
    setPlatform('linux');
    const exec = fakeExec(null, 'ok');
    const result = await runWfCaptured(['indexes', 'generate', '--flow', 'a%b'], { cwd: '/ws', timeoutMs: 1000 }, exec);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ exitCode: 0, stdout: 'ok', stderr: '' });
  });

  it('spawns a safe argv on win32', async () => {
    setPlatform('win32');
    const exec = fakeExec(null, 'ok');
    const result = await runWfCaptured(['indexes', 'generate', '--flow', 'a-b'], { cwd: '/ws', timeoutMs: 1000 }, exec);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ exitCode: 0, stdout: 'ok', stderr: '' });
  });
});
