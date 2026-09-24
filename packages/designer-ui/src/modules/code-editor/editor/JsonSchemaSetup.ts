import type { Monaco } from '@monaco-editor/react';
import type { VnextWorkspacePaths } from '@vnext-forge-studio/app-contracts';
import { fetchVnextSchemas, type VnextSchemaMap } from './JsonSchemaRegistry';
import { createLogger } from '../../../lib/logger/createLogger';

const logger = createLogger('JsonSchemaSetup');

const COMPONENT_TYPE_TO_PATH_KEY: Record<string, keyof Omit<VnextWorkspacePaths, 'componentsRoot'>> = {
  workflow: 'workflows',
  task: 'tasks',
  view: 'views',
  function: 'functions',
  extension: 'extensions',
  schema: 'schemas',
  mapping: 'mappings',
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

export interface MonacoJsonSchemaEntry {
  uri: string;
  fileMatch: string[];
  schema: object;
}

/** Monaco `jsonDefaults` schema entries; the uri carries the version so a switch replaces them. */
export function buildMonacoJsonSchemas(
  schemas: VnextSchemaMap,
  paths?: VnextWorkspacePaths | null,
  schemaVersion?: string,
): MonacoJsonSchemaEntry[] {
  const versionSegment = schemaVersion ?? 'bundled';
  const entries: MonacoJsonSchemaEntry[] = [];
  for (const [type, schema] of Object.entries(schemas)) {
    if (type === 'core' || type === 'header') continue;
    const fileMatch = buildFileMatchPatterns(type, paths);
    if (fileMatch.length === 0) continue;
    entries.push({ uri: `vnext://schemas/${versionSegment}/${type}-definition`, fileMatch, schema });
  }
  return entries;
}

export interface JsonSchemaValidationOptions {
  /** Workspace folder names (`vnext.config.json#paths`); defaults to the conventional ones. */
  paths?: VnextWorkspacePaths | null;
  /** Project-pinned `@burgan-tech/vnext-schema` version; omitted → bundled package. */
  schemaVersion?: string;
}

let latestRequest = 0;

/**
 * Register the vNext component schemas with Monaco's JSON language service.
 * `setDiagnosticsOptions` is global per Monaco instance, so the latest call
 * wins: an older request that resolves later is discarded.
 */
export async function configureJsonSchemaValidation(
  monaco: Monaco,
  options: JsonSchemaValidationOptions = {},
): Promise<void> {
  latestRequest += 1;
  const request = latestRequest;
  const schemas = await fetchVnextSchemas(options.schemaVersion);
  if (request !== latestRequest) return;

  if (!schemas) {
    logger.warn('No vnext schemas available for Monaco JSON validation');
    return;
  }

  const entries = buildMonacoJsonSchemas(schemas, options.paths, options.schemaVersion);
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    enableSchemaRequest: false,
    schemas: entries,
  });

  logger.info(
    `Registered ${entries.length} JSON schemas for Monaco validation (${options.schemaVersion ?? 'bundled'})`,
  );
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
