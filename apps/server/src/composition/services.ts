import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  buildMethodRegistry,
  createCliService,
  createPathPolicy,
  createProjectService,
  createQuickRunPresetsService,
  createQuickRunService,
  createQuickswitcherService,
  createRuntimeProxyService,
  createSchemaCacheService,
  createSessionsService,
  createSnippetsService,
  createTemplateService,
  createTestDataService,
  createValidateService,
  createWorkspaceService,
  type LoggerAdapter,
  type MethodRegistry,
  type ServiceRegistry,
  type TemplateInitScriptResolver,
  type VnextSchemaLoader,
  type VnextSchemaModule,
} from '@vnext-forge-studio/services-core';

import { createNodeFileSystemAdapter } from '../adapters/node-file-system.js';
import { createNodeNetworkAdapter } from '../adapters/node-network.js';
import { createNodeProcessAdapter } from '../adapters/node-process.js';
import { createNodeWorkspaceRootResolver } from '../adapters/node-workspace-root.js';
import { config } from '../shared/config/config.js';

const nodeRequire = createRequire(import.meta.url);

const schemaLoader: VnextSchemaLoader = {
  load(): VnextSchemaModule {
    return nodeRequire('@burgan-tech/vnext-schema') as VnextSchemaModule;
  },
};

/**
 * Bundled `@burgan-tech/vnext-schema` version. Read from the package's own
 * package.json so the schema-cache service can advertise it to the UI
 * without hard-coding. Falls back to `"unknown"` when the read fails — the
 * version mismatch warning then shows "bundled (unknown)".
 */
function readBundledVersion(): string {
  try {
    const pkgPath = nodeRequire.resolve('@burgan-tech/vnext-schema/package.json');
    const pkg = nodeRequire(pkgPath) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

const initScriptResolver: TemplateInitScriptResolver = {
  resolve(): string {
    return nodeRequire.resolve('@burgan-tech/vnext-template/init.js');
  },
};

export interface ComposedServices {
  services: ServiceRegistry;
  registry: MethodRegistry;
}

/**
 * Build the canonical `ServiceRegistry` + `MethodRegistry` for the standalone
 * web server. All Node.js-specific I/O (fs, child_process, fetch, schema /
 * template module loading) is wired up here; the underlying services and
 * registry are 100 % shared with the VS Code extension shell.
 */
export function composeWebServerServices(logger: LoggerAdapter): ComposedServices {
  const fs = createNodeFileSystemAdapter();
  const network = createNodeNetworkAdapter();
  const processAdapter = createNodeProcessAdapter();
  const workspaceRootResolver = createNodeWorkspaceRootResolver();

  const pathPolicy = createPathPolicy({
    fs,
    logger,
    approvedRoots: config.workspaceAllowedRoots,
  });

  const workspaceService = createWorkspaceService({ fs, logger, pathPolicy });
  const templateService = createTemplateService({
    fs,
    process: processAdapter,
    logger,
    initScriptResolver,
  });
  const projectService = createProjectService({
    fs,
    logger,
    workspaceRootResolver,
    workspaceService,
    templateService,
    pathPolicy,
  });
  // OS-canonical user-data dir (Electron `app.getPath('userData')` is passed
  // through `VNEXT_USER_DATA_DIR`; non-Electron shells fall back to the
  // home dir). Both the schema cache AND sessions/presets share this root.
  const userDataDir = process.env.VNEXT_USER_DATA_DIR
    ? process.env.VNEXT_USER_DATA_DIR
    : join(homedir(), '.vnext-studio');

  // Schema cache: per-version `@burgan-tech/vnext-schema` packages downloaded
  // from npm into the user-data dir, so validation honours each project's
  // `vnext.config.json#schemaVersion` instead of always validating against
  // whatever sub-version the desktop app happened to ship with.
  const schemaCacheRoot = join(userDataDir, 'schema-cache').replace(/\\/g, '/');
  const bundledSchemaModule = schemaLoader.load();
  const schemaCacheService = createSchemaCacheService({
    fs,
    logger,
    cacheRoot: schemaCacheRoot,
    bundledModule: bundledSchemaModule,
    bundledVersion: readBundledVersion(),
  });

  const validateService = createValidateService({
    schemaLoader,
    logger,
    schemaCacheService,
  });
  const runtimeProxyService = createRuntimeProxyService({
    network,
    logger,
    defaultRuntimeUrl: config.vnextRuntimeUrl,
    allowedBaseUrls: config.runtimeAllowedBaseUrls,
    allowRuntimeUrlOverride: config.allowRuntimeUrlOverride,
  });

  const quickRunService = createQuickRunService(runtimeProxyService);
  const quickswitcherService = createQuickswitcherService({ fs, logger, projectService });

  // Personal snippets live in the user's home dir; project snippets live
  // alongside the project sources. The service factory needs the absolute
  // personal root because services-core stays Node-free.
  const personalSnippetsRoot = join(homedir(), '.vnext-studio', 'snippets').replace(/\\/g, '/');
  const snippetsService = createSnippetsService({
    fs,
    logger,
    projectService,
    personalRoot: personalSnippetsRoot,
  });
  // Sessions live in the OS-canonical app-data location, never in the
  // project tree — per-developer state, no .gitignore plumbing. The
  // `userDataDir` is resolved above (alongside the schema cache).
  const personalSessionsRoot = join(userDataDir, 'sessions').replace(/\\/g, '/');
  const sessionsService = createSessionsService({
    fs,
    logger,
    projectService,
    personalRoot: personalSessionsRoot,
  });
  const testDataService = createTestDataService({ fs, logger, projectService });

  // QuickRun presets share the OS-canonical userData directory with sessions.
  const presetsRoot = join(userDataDir, 'quickrun-presets').replace(/\\/g, '/');
  const quickRunPresetsService = createQuickRunPresetsService({
    fs,
    logger,
    presetsRoot,
  });

  const cliService = createCliService({ pathPolicy });

  const services: ServiceRegistry = {
    workspaceService,
    projectService,
    templateService,
    validateService,
    runtimeProxyService,
    quickRunService,
    cliService,
    quickswitcherService,
    sessionsService,
    snippetsService,
    testDataService,
    quickRunPresetsService,
  };

  return { services, registry: buildMethodRegistry() };
}
