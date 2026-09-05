import { describe, expect, it } from 'vitest';

import { extractRuntimeErrorLines, summarizeRuntimeError } from './RuntimeErrorBanner';

describe('summarizeRuntimeError', () => {
  it('reads the Aether envelope the engine returns for a rejected filter', () => {
    const s = summarizeRuntimeError({
      code: 'RUNTIME_EXECUTION_FAILED',
      message: 'Runtime returned HTTP 400',
      traceId: 'forge-trace',
      details: {
        httpStatus: 400,
        error: {
          prefix: 'Validation',
          code: '900011',
          message: 'Instance filter is invalid.',
          target: 'filter',
          validationErrors: [
            { message: "Unsupported operator 'gte'. Did you mean 'ge'?", members: ['filter.unknownOperator'] },
            { message: 'Expected array for value list', members: ['filter.invalidJson'] },
          ],
        },
      },
    });
    expect(s.httpStatus).toBe(400);
    expect(s.code).toBe('Validation:900011');
    expect(s.summary).toBe('Instance filter is invalid.');
    expect(s.lines).toEqual([
      { code: 'filter.unknownOperator', message: "Unsupported operator 'gte'. Did you mean 'ge'?" },
      { code: 'filter.invalidJson', message: 'Expected array for value list' },
    ]);
    expect(s.traceId).toBe('forge-trace');
  });

  it('does not double the prefix when code already carries it', () => {
    const s = summarizeRuntimeError({
      code: 'X', message: 'm',
      details: { error: { prefix: 'Validation', code: 'Validation:900012', message: 'Sort is invalid.' } },
    });
    expect(s.code).toBe('Validation:900012');
  });

  it('reads flat and RFC 7807 shapes too', () => {
    const flat = summarizeRuntimeError({
      code: 'X', message: 'fallback',
      details: { httpStatus: 400, code: 'Validation:900011', message: 'flat', errors: [{ code: 'filter.noOperator', message: 'no op' }, 'plain'] },
    });
    expect(flat.code).toBe('Validation:900011');
    expect(flat.summary).toBe('flat');
    expect(flat.lines).toEqual([{ code: 'filter.noOperator', message: 'no op' }, { message: 'plain' }]);

    const problem = summarizeRuntimeError({
      code: 'X', message: 'fallback',
      details: { status: 400, title: 'Bad Request', detail: 'One or more validation errors occurred.', errors: { sort: ['invalid json'] } },
    });
    expect(problem.httpStatus).toBe(400);
    expect(problem.summary).toBe('One or more validation errors occurred.');
    expect(problem.lines).toEqual([{ code: 'sort', message: 'invalid json' }]);
  });

  it('falls back to the ApiFailure message when the body has nothing usable', () => {
    const s = summarizeRuntimeError({ code: 'RUNTIME_CONNECTION_FAILED', message: 'Could not reach the runtime.' });
    expect(s.summary).toBe('Could not reach the runtime.');
    expect(s.lines).toEqual([]);
    expect(s.code).toBeUndefined();
  });
});

describe('extractRuntimeErrorLines', () => {
  it('ignores malformed entries', () => {
    expect(extractRuntimeErrorLines({ validationErrors: [null, 42, { members: ['x'] }], errors: [{}] })).toEqual([]);
  });
});
