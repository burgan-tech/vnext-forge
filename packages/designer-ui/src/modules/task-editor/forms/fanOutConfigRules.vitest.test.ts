import { describe, expect, it } from 'vitest';

import { isValidItemsPath, validateFanOutConfig } from './fanOutConfigRules';

const TASK = { key: 'inner', domain: 'core', flow: 'sys-tasks', version: '1.0.0' };

describe('isValidItemsPath', () => {
  it.each(['$.documents', '$.documents.online', '$.a_b.c1'])('accepts %s', (p) => {
    expect(isValidItemsPath(p)).toBe(true);
  });
  it.each(['documents', '$', '$.', '$.docs[0]', '$.docs[*]', '$..docs', '$.docs[?(@.x)]'])('rejects %s', (p) => {
    expect(isValidItemsPath(p)).toBe(false);
  });
});

describe('validateFanOutConfig', () => {
  it('passes a minimal valid config with no warnings', () => {
    expect(validateFanOutConfig({ task: TASK })).toEqual({ errors: {}, warnings: {} });
  });

  it('requires every inner task field individually', () => {
    const { errors } = validateFanOutConfig({ task: { key: 'x', domain: '' } });
    expect(Object.keys(errors).sort()).toEqual(['task.domain', 'task.flow', 'task.version']);
  });

  it('reports a missing task entirely', () => {
    const { errors } = validateFanOutConfig({});
    expect(errors['task.key']).toBeDefined();
    expect(errors['task.version']).toBeDefined();
  });

  it('flags a non "$."-rooted itemsPath', () => {
    expect(validateFanOutConfig({ task: TASK, itemsPath: 'docs' }).errors.itemsPath).toMatch(/\$\./);
  });

  it('flags filters/wildcards in itemsPath with a specific message', () => {
    expect(validateFanOutConfig({ task: TASK, itemsPath: '$.docs[*]' }).errors.itemsPath).toMatch(/property navigation/);
  });

  it('leaves itemsPath alone when absent (ItemSelector leg of the XOR)', () => {
    expect(validateFanOutConfig({ task: TASK }).errors.itemsPath).toBeUndefined();
  });

  it('rejects a non-inline mode', () => {
    expect(validateFanOutConfig({ task: TASK, mode: 'durable' }).errors.mode).toBeDefined();
    expect(validateFanOutConfig({ task: TASK, mode: 'inline' }).errors.mode).toBeUndefined();
  });

  it('requires minSuccess for quorum', () => {
    expect(validateFanOutConfig({ task: TASK, join: { policy: 'quorum' } }).errors['join.minSuccess']).toBeDefined();
    expect(validateFanOutConfig({ task: TASK, join: { policy: 'quorum', minSuccess: 0 } }).errors['join.minSuccess']).toBeDefined();
    expect(validateFanOutConfig({ task: TASK, join: { policy: 'quorum', minSuccess: 2 } }).errors['join.minSuccess']).toBeUndefined();
  });

  it('warns when minSuccess is set on a non-quorum policy', () => {
    const { errors, warnings } = validateFanOutConfig({ task: TASK, join: { policy: 'allSettled', minSuccess: 3 } });
    expect(errors['join.minSuccess']).toBeUndefined();
    expect(warnings['join.minSuccess']).toMatch(/quorum/);
  });

  it('warns about the empty-batch failure of threshold policies', () => {
    expect(validateFanOutConfig({ task: TASK, join: { policy: 'firstSuccess' } }).warnings['join.policy']).toMatch(/empty batch/);
    expect(validateFanOutConfig({ task: TASK, join: { policy: 'all' } }).warnings['join.policy']).toBeUndefined();
  });

  it('rejects an unknown join policy', () => {
    expect(validateFanOutConfig({ task: TASK, join: { policy: 'majority' } }).errors['join.policy']).toBeDefined();
  });

  it('rejects an empty resultKey but accepts an unset one', () => {
    expect(validateFanOutConfig({ task: TASK, join: { resultKey: ' ' } }).errors['join.resultKey']).toBeDefined();
    expect(validateFanOutConfig({ task: TASK, join: {} }).errors['join.resultKey']).toBeUndefined();
  });

  it('rejects execution values below 1', () => {
    const { errors } = validateFanOutConfig({
      task: TASK,
      execution: { maxDegreeOfParallelism: 0, itemTimeoutSeconds: 0, batchTimeoutSeconds: -5 },
    });
    expect(errors['execution.maxDegreeOfParallelism']).toBeDefined();
    expect(errors['execution.itemTimeoutSeconds']).toBeDefined();
    expect(errors['execution.batchTimeoutSeconds']).toBeDefined();
  });

  it('rejects an item timeout longer than the batch timeout, on both fields', () => {
    const { errors } = validateFanOutConfig({ task: TASK, execution: { itemTimeoutSeconds: 200, batchTimeoutSeconds: 120 } });
    expect(errors['execution.itemTimeoutSeconds']).toMatch(/cannot exceed/);
    expect(errors['execution.batchTimeoutSeconds']).toMatch(/cannot exceed/);
  });

  it('compares against the runtime defaults when one side is unset', () => {
    // item 200 vs default batch 120 → error; batch 10 vs default item 30 → error
    expect(validateFanOutConfig({ task: TASK, execution: { itemTimeoutSeconds: 200 } }).errors['execution.itemTimeoutSeconds']).toBeDefined();
    expect(validateFanOutConfig({ task: TASK, execution: { batchTimeoutSeconds: 10 } }).errors['execution.batchTimeoutSeconds']).toBeDefined();
    expect(validateFanOutConfig({ task: TASK, execution: { itemTimeoutSeconds: 30, batchTimeoutSeconds: 30 } }).errors).toEqual({});
  });

  it('warns above the parallelism threshold without erroring', () => {
    const { errors, warnings } = validateFanOutConfig({ task: TASK, execution: { maxDegreeOfParallelism: 32 } });
    expect(errors['execution.maxDegreeOfParallelism']).toBeUndefined();
    expect(warnings['execution.maxDegreeOfParallelism']).toBeDefined();
  });
});
