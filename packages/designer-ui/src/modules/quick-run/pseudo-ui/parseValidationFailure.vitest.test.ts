import { describe, expect, it } from 'vitest';

import { parseValidationFailure } from './parseValidationFailure';

describe('parseValidationFailure (R24.5)', () => {
  it('returns null when there is no validation payload', () => {
    expect(parseValidationFailure(null)).toBeNull();
    expect(parseValidationFailure(undefined)).toBeNull();
    expect(parseValidationFailure({ code: 'X', message: 'plain' })).toBeNull();
    expect(parseValidationFailure({ code: 'X', message: 'plain', details: { foo: 'bar' } })).toBeNull();
  });

  it('parses the rich error.data.validation.errors[] shape', () => {
    const failure = parseValidationFailure({
      code: 'App:900002',
      message: 'JSON schema validation failed',
      details: {
        error: {
          prefix: 'validation',
          data: {
            validation: {
              culture: 'tr-TR',
              errors: [
                {
                  path: 'session',
                  keyword: 'minLength',
                  message: 'Value should be at least 1 characters',
                  label: 'Oturum',
                  parameters: { minLength: 1 },
                },
                {
                  path: 'customer.ownerUserId',
                  keyword: 'minLength',
                  message: 'Value should be at least 1 characters',
                  label: 'Sahip Kullanıcı ID',
                },
              ],
            },
          },
        },
      },
    });
    expect(failure).not.toBeNull();
    expect(failure!.topMessage).toBe('JSON schema validation failed');
    expect(failure!.fieldErrors).toEqual([
      {
        path: 'session',
        message: 'Value should be at least 1 characters',
        label: 'Oturum',
        keyword: 'minLength',
        parameters: { minLength: 1 },
      },
      {
        path: 'customer.ownerUserId',
        message: 'Value should be at least 1 characters',
        label: 'Sahip Kullanıcı ID',
        keyword: 'minLength',
        parameters: undefined,
      },
    ]);
  });

  it('parses the slim error.validationErrors[] shape (members + message)', () => {
    const failure = parseValidationFailure({
      code: 'App:900002',
      message: 'JSON schema validation failed',
      details: {
        error: {
          validationErrors: [
            { members: ['session'], message: 'Value should be at least 1 characters' },
            { members: ['customer', 'ownerUserId'], message: 'Value should be at least 1 characters' },
          ],
        },
      },
    });
    expect(failure).not.toBeNull();
    expect(failure!.fieldErrors).toEqual([
      { path: 'session', message: 'Value should be at least 1 characters' },
      { path: 'customer.ownerUserId', message: 'Value should be at least 1 characters' },
    ]);
  });

  it('finds errors regardless of how many wrappers the transport adds', () => {
    const failure = parseValidationFailure({
      code: 'E',
      message: 'Validation failed',
      details: {
        validationErrors: [
          { members: ['amount'], message: 'must be > 0' },
        ],
      },
    });
    expect(failure).not.toBeNull();
    expect(failure!.fieldErrors[0]?.path).toBe('amount');
  });
});
