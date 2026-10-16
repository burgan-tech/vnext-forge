import { describe, expect, it } from 'vitest';

import type { FunctionCatalogEntry } from '../quick-run/types/quickrun.types';

import {
  FILE_FUNCTION_CATALOG_ENTRY,
  buildFileFunctionEndpoint,
  describeFileFunctionResult,
  fileFunctionInvokeBlocker,
  isFileFunction,
  withBuiltInFileFunction,
} from './functionRunFile';

const custom: FunctionCatalogEntry = { name: 'get-balance', version: '1.0.0', scope: 'I', href: '/x' };

describe('isFileFunction', () => {
  it('matches only the reserved key', () => {
    expect(isFileFunction('file')).toBe(true);
    expect(isFileFunction('files')).toBe(false);
    expect(isFileFunction('File')).toBe(false);
  });
});

describe('withBuiltInFileFunction', () => {
  it('appends the built-in to the engine catalog', () => {
    expect(withBuiltInFileFunction([custom], true)).toEqual([custom, FILE_FUNCTION_CATALOG_ENTRY]);
  });

  it('offers the built-in alone when the instance has no catalog', () => {
    expect(withBuiltInFileFunction(null, true)).toEqual([FILE_FUNCTION_CATALOG_ENTRY]);
    expect(withBuiltInFileFunction([], undefined)).toEqual([FILE_FUNCTION_CATALOG_ENTRY]);
  });

  it('leaves the catalog alone on a runtime older than 0.0.100', () => {
    const entries = [custom];
    expect(withBuiltInFileFunction(entries, false)).toBe(entries);
    expect(withBuiltInFileFunction(null, false)).toBeNull();
  });

  it('does not add a second entry when the catalog already lists it', () => {
    const entries = [custom, { ...custom, name: 'file' }];
    expect(withBuiltInFileFunction(entries, true)).toBe(entries);
  });

  it('is instance-scoped', () => {
    expect(FILE_FUNCTION_CATALOG_ENTRY.scope).toBe('I');
  });
});

describe('buildFileFunctionEndpoint', () => {
  it('builds the instance route with the file query', () => {
    expect(
      buildFileFunctionEndpoint({ domain: 'core', workflowKey: 'onboarding', instanceId: 'abc', file: 'f-1' }),
    ).toBe('/api/v1/core/workflows/onboarding/instances/abc/functions/file?file=f-1');
  });

  it('shows named placeholders for blanks', () => {
    expect(buildFileFunctionEndpoint({ domain: 'core', workflowKey: ' ', instanceId: '', file: '' })).toBe(
      '/api/v1/core/workflows/{workflowKey}/instances/{instanceId}/functions/file?file={file}',
    );
  });

  it('encodes and trims values', () => {
    expect(
      buildFileFunctionEndpoint({ domain: 'core', workflowKey: 'wf', instanceId: ' i d ', file: 'a&b' }),
    ).toBe('/api/v1/core/workflows/wf/instances/i%20d/functions/file?file=a%26b');
  });
});

describe('fileFunctionInvokeBlocker', () => {
  const ready = { domain: 'core', workflowKey: 'wf', instanceId: 'i', file: 'f' };

  it('allows a complete request', () => {
    expect(fileFunctionInvokeBlocker(ready)).toBeNull();
  });

  it('asks for the instance binding first', () => {
    expect(fileFunctionInvokeBlocker({ ...ready, workflowKey: '' })).toMatch(/workflow key/);
    expect(fileFunctionInvokeBlocker({ ...ready, instanceId: '  ' })).toMatch(/instance id/);
  });

  it('asks for the file id', () => {
    expect(fileFunctionInvokeBlocker({ ...ready, file: ' ' })).toMatch(/file id/);
  });
});

describe('describeFileFunctionResult', () => {
  it('uses the response metadata', () => {
    expect(
      describeFileFunctionResult(
        { contentBase64: '', contentType: 'application/pdf', size: 2048, fileName: 'id.pdf', eTag: 'abc' },
        'f-1',
      ),
    ).toEqual({ fileName: 'id.pdf', mimeType: 'application/pdf', sizeLabel: '2.0 KB', eTag: 'abc' });
  });

  it('falls back to the file id and a generic content type', () => {
    expect(describeFileFunctionResult({ contentBase64: '', contentType: '', size: 3 }, ' f-1 ')).toEqual({
      fileName: 'f-1',
      mimeType: 'application/octet-stream',
      sizeLabel: '3 B',
      eTag: null,
    });
  });
});
