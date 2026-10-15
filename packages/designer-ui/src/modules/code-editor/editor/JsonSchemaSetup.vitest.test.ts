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
import {
  buildMonacoJsonSchemas,
  buildMonacoVocabularyEntries,
  configureJsonSchemaValidation,
} from './JsonSchemaSetup';

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

const VOCAB_ID = 'https://unpkg.com/@burgan-tech/vnext-schema@0.0.56/vocabularies/record-vocab.json';

/** `respond` answers `validate/getAllSchemas`; vocabulary requests get `vocabularies`. */
function useTransport(
  respond: (params: unknown) => Promise<ApiResponse<unknown>>,
  vocabularies: Record<string, object> = {},
) {
  const send = vi.fn((method: string, params: unknown) =>
    method === 'validate/getVocabularies' ? Promise.resolve(success(vocabularies)) : respond(params),
  );
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

describe('buildMonacoVocabularyEntries', () => {
  it('registers each vocabulary under its $id without a file match', () => {
    expect(buildMonacoVocabularyEntries({ [VOCAB_ID]: { $id: VOCAB_ID } })).toEqual([
      { uri: VOCAB_ID, fileMatch: [], schema: { $id: VOCAB_ID } },
    ]);
  });
});

describe('configureJsonSchemaValidation', () => {
  it('registers the vocabularies alongside the component schemas', async () => {
    const send = useTransport(() => Promise.resolve(success({ schema: { title: 'pinned' } })), {
      [VOCAB_ID]: { $id: VOCAB_ID },
    });
    const { monaco, setDiagnosticsOptions } = fakeMonaco();

    await configureJsonSchemaValidation(monaco, { paths: PATHS, schemaVersion: '0.0.56' });

    expect(send).toHaveBeenCalledWith('validate/getVocabularies', { schemaVersion: '0.0.56' });
    expect(setDiagnosticsOptions.mock.calls[0]?.[0].schemas).toEqual([
      {
        uri: 'vnext://schemas/0.0.56/schema-definition',
        fileMatch: ['**/Schemas/**/*.json', '**/Schemas/*.json'],
        schema: { title: 'pinned' },
      },
      { uri: VOCAB_ID, fileMatch: [], schema: { $id: VOCAB_ID } },
    ]);
  });

  it('still registers the component schemas when the vocabulary request fails', async () => {
    const send = vi.fn((method: string) =>
      method === 'validate/getVocabularies'
        ? Promise.resolve({ success: false, data: null, error: { code: ERROR_CODES.INTERNAL_UNEXPECTED, message: 'x' } })
        : Promise.resolve(success({ task: {} })),
    );
    setApiTransport({ send: send as unknown as <T>(method: string, params: unknown) => Promise<ApiResponse<T>> });
    const { monaco, setDiagnosticsOptions } = fakeMonaco();

    await configureJsonSchemaValidation(monaco);

    expect(setDiagnosticsOptions.mock.calls[0]?.[0].schemas).toHaveLength(1);
  });

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
    // One schema + one vocabulary request per version.
    expect(send).toHaveBeenCalledTimes(2);
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.53' });
    expect(send).toHaveBeenCalledTimes(4);
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
