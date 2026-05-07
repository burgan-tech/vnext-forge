import type { Monaco } from '@monaco-editor/react';
import type { VnextWorkspacePaths } from '@vnext-forge-studio/app-contracts';
import { fetchVnextSchemas, getCachedSchemas } from './JsonSchemaRegistry';
import { createLogger } from '../../../lib/logger/createLogger';

const logger = createLogger('JsonSchemaSetup');

const COMPONENT_TYPE_TO_PATH_KEY: Record<string, keyof Omit<VnextWorkspacePaths, 'componentsRoot'>> = {
  workflow: 'workflows',
  task: 'tasks',
  view: 'views',
  function: 'functions',
  extension: 'extensions',
  schema: 'schemas',
};

function buildFileMatchPatterns(
  componentType: string,
  paths?: VnextWorkspacePaths | null,
): string[] {
  const pathKey = COMPONENT_TYPE_TO_PATH_KEY[componentType];
  if (!pathKey) return [];

  const folderName = paths?.[pathKey] ?? pathKey.charAt(0).toUpperCase() + pathKey.slice(1);
  return [`**/${folderName}/**/*.json`, `**/${folderName}/*.json`];
}

export async function configureJsonSchemaValidation(
  monaco: Monaco,
  paths?: VnextWorkspacePaths | null,
): Promise<void> {
  const cached = getCachedSchemas();
  const schemaData = cached ?? (await fetchVnextSchemas());

  if (!schemaData) {
    logger.warn('No vnext schemas available for Monaco JSON validation');
    return;
  }

  const monacoSchemas: Array<{
    uri: string;
    fileMatch: string[];
    schema: object;
  }> = [];

  for (const [type, schema] of Object.entries(schemaData.schemas)) {
    if (type === 'core' || type === 'header') continue;

    const fileMatch = buildFileMatchPatterns(type, paths);
    if (fileMatch.length === 0) continue;

    monacoSchemas.push({
      uri: `vnext://schemas/${type}-definition`,
      fileMatch,
      schema,
    });
  }

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    enableSchemaRequest: false,
    schemas: monacoSchemas,
  });

  logger.info(`Registered ${monacoSchemas.length} JSON schemas for Monaco validation`);
}

export function detectComponentType(
  filePath: string,
  paths?: VnextWorkspacePaths | null,
): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const [type, pathKey] of Object.entries(COMPONENT_TYPE_TO_PATH_KEY)) {
    const folderName = paths?.[pathKey] ?? pathKey.charAt(0).toUpperCase() + pathKey.slice(1);
    if (
      normalizedPath.includes(`/${folderName}/`) ||
      normalizedPath.includes(`\\${folderName}\\`)
    ) {
      return type;
    }
  }

  return null;
}
