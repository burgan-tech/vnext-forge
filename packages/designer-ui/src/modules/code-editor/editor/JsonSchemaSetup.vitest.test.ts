import type { Monaco } from '@monaco-editor/react';
import {
  ERROR_CODES,
  success,
  type ApiResponse,
  type VnextWorkspacePaths,
} from '@vnext-forge-studio/app-contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setApiTransport } from '../../../api/transport';
import { invalidateSchemaCache } from './JsonSchemaRegistry';
import { buildMonacoJsonSchemas, configureJsonSchemaValidation } from './JsonSchemaSetup';

const PATHS: VnextWorkspacePaths = {
  componentsRoot: 'core',
  tasks: 'Tasks',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
  workflows: 'Flows',
  schemas: 'Schemas',
  mappings: 'Mappings',
};

function fakeMonaco() {
  const setDiagnosticsOptions = vi.fn();
  const monaco = { languages: { json: { jsonDefaults: { setDiagnosticsOptions } } } } as unknown as Monaco;
  return { monaco, setDiagnosticsOptions };
}

function useTransport(respond: (params: unknown) => Promise<ApiResponse<unknown>>) {
  const send = vi.fn((_method: string, params: unknown) => respond(params));
  setApiTransport({ send: send as unknown as <T>(method: string, params: unknown) => Promise<ApiResponse<T>> });
  return send;
}

beforeEach(() => invalidateSchemaCache());
afterEach(() => setApiTransport(null));

describe('buildMonacoJsonSchemas', () => {
  it('maps component types to the configured folders and skips core/header', () => {
    expect(
      buildMonacoJsonSchemas({ workflow: { title: 'wf' }, schema: { title: 's' }, core: {}, header: {}, unknown: {} }, PATHS, '0.0.52'),
    ).toEqual([
      { uri: 'vnext://schemas/0.0.52/workflow-definition', fileMatch: ['**/Flows/**/*.json', '**/Flows/*.json'], schema: { title: 'wf' } },
      { uri: 'vnext://schemas/0.0.52/schema-definition', fileMatch: ['**/Schemas/**/*.json', '**/Schemas/*.json'], schema: { title: 's' } },
    ]);
  });

  it('falls back to conventional folder names and a bundled uri', () => {
    expect(buildMonacoJsonSchemas({ task: {} }, null)).toEqual([
      { uri: 'vnext://schemas/bundled/task-definition', fileMatch: ['**/Tasks/**/*.json', '**/Tasks/*.json'], schema: {} },
    ]);
  });
});

describe('configureJsonSchemaValidation', () => {
  it('requests the project-pinned version and registers its schemas', async () => {
    const send = useTransport(() => Promise.resolve(success({ schema: { title: 'pinned' } })));
    const { monaco, setDiagnosticsOptions } = fakeMonaco();

    await configureJsonSchemaValidation(monaco, { paths: PATHS, schemaVersion: '0.0.52' });

    expect(send).toHaveBeenCalledWith('validate/getAllSchemas', { schemaVersion: '0.0.52' });
    expect(setDiagnosticsOptions).toHaveBeenCalledWith({
      validate: true,
      enableSchemaRequest: false,
      schemas: [
        {
          uri: 'vnext://schemas/0.0.52/schema-definition',
          fileMatch: ['**/Schemas/**/*.json', '**/Schemas/*.json'],
          schema: { title: 'pinned' },
        },
      ],
    });
  });

  it('asks for the bundled schemas when the project pins nothing', async () => {
    const send = useTransport(() => Promise.resolve(success({})));
    await configureJsonSchemaValidation(fakeMonaco().monaco);
    expect(send).toHaveBeenCalledWith('validate/getAllSchemas', {});
  });

  it('caches per version', async () => {
    const send = useTransport(() => Promise.resolve(success({ task: {} })));
    const { monaco } = fakeMonaco();
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.52' });
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.52' });
    expect(send).toHaveBeenCalledTimes(1);
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.53' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('leaves Monaco untouched when the request fails', async () => {
    useTransport(() =>
      Promise.resolve({ success: false, data: null, error: { code: ERROR_CODES.INTERNAL_UNEXPECTED, message: 'boom' } }),
    );
    const { monaco, setDiagnosticsOptions } = fakeMonaco();
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.52' });
    expect(setDiagnosticsOptions).not.toHaveBeenCalled();
  });

  it('lets the latest call win when an older request resolves later', async () => {
    let releaseOld: (() => void) | undefined;
    useTransport((params) => {
      if ((params as { schemaVersion?: string }).schemaVersion === '0.0.40') {
        return new Promise((resolve) => {
          releaseOld = () => resolve(success({ schema: { title: 'old' } }));
        });
      }
      return Promise.resolve(success({ schema: { title: 'new' } }));
    });
    const { monaco, setDiagnosticsOptions } = fakeMonaco();

    const older = configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.40' });
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.52' });
    releaseOld?.();
    await older;

    expect(setDiagnosticsOptions).toHaveBeenCalledTimes(1);
    expect(setDiagnosticsOptions.mock.calls[0]?.[0]).toMatchObject({ schemas: [{ schema: { title: 'new' } }] });
  });
});
