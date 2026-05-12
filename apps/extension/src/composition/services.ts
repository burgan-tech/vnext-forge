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
} from '@vnext-forge-studio/services-core';

import { createVsCodeFileSystemAdapter } from '../adapters/vscode-file-system.js';
import { createVsCodeNetworkAdapter } from '../adapters/vscode-network.js';
import { createVsCodeProcessAdapter } from '../adapters/vscode-process.js';
import { createVsCodeWorkspaceRootResolver } from '../adapters/vscode-workspace-root.js';
import { extensionConfig } from '../shared/config.js';

interface VnextSchemaModule {
  getSchema(type: string): Record<string, unknown> | null;
  getAvailableTypes(): string[];
  schemas: Record<string, Record<string, unknown>>;
}

/**
 * The extension host ships as a CommonJS bundle (`esbuild format: 'cjs'`).
 * Static `require()` calls are safe — esbuild bundles `@burgan-tech/vnext-schema`
 * directly, while `@burgan-tech/vnext-template` is marked `external` and its
 * files are copied into `dist/vendor/` so `init.js` can be spawned as a
 * child process.
 */
const schemaLoader: VnextSchemaLoader = {
  load(): VnextSchemaModule {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@burgan-tech/vnext-schema') as VnextSchemaModule;
  },
};

/**
 * Bundled `@burgan-tech/vnext-schema` version. Used by the schema-cache
 * service to advertise the fallback version to the UI. Mirrors the
 * desktop shell's `readBundledVersion()` helper.
 */
function readBundledSchemaVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@burgan-tech/vnext-schema/package.json') as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

const initScriptResolver: TemplateInitScriptResolver = {
  resolve(): string {
    return require.resolve('@burgan-tech/vnext-template/init.js');
  },
};

export interface ComposedServices {
  services: ServiceRegistry;
  registry: MethodRegistry;
}

/**
 * Build the canonical `ServiceRegistry` + `MethodRegistry` for the VS Code
 * extension host. Wires the same `services-core` services as the web server,
 * but plugs in VS Code-flavoured adapters (workspace folder resolver,
 * OutputChannel logger, Node fs/child_process).
 */
export function composeExtensionServices(logger: LoggerAdapter): ComposedServices {
  const fs = createVsCodeFileSystemAdapter();
  const network = createVsCodeNetworkAdapter();
  const processAdapter = createVsCodeProcessAdapter();
  const workspaceRootResolver = createVsCodeWorkspaceRootResolver();

  // Path policy is needed by `projectService` (jail check on workspace
  // paths) and `cliService` (workspace cwd resolution). Empty
  // `approvedRoots` puts the policy in OPEN mode — fine for the
  // single-developer extension host scenario (the desktop shell hardens
  // this list from `apps/server/.env`).
  const pathPolicy = createPathPolicy({
    fs,
    logger,
    approvedRoots: [],
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

  // OS user-data dir for the extension host. Mirrors the desktop layout
  // (`~/.vnext-studio`) so sessions / snippets / presets / schema-cache
  // are findable from either shell. `VNEXT_USER_DATA_DIR` override is
  // honoured for tests and CI scenarios.
  const userDataDir = process.env.VNEXT_USER_DATA_DIR
    ? process.env.VNEXT_USER_DATA_DIR
    : join(homedir(), '.vnext-studio');

  // Schema cache: per-version `@burgan-tech/vnext-schema` packages
  // downloaded from npm into the user-data dir. Same code path as the
  // desktop shell so validation honours each project's pinned
  // schemaVersion instead of the bundle the extension shipped with.
  const schemaCacheRoot = join(userDataDir, 'schema-cache').replace(/\\/g, '/');
  const bundledSchemaModule = schemaLoader.load();
  const schemaCacheService = createSchemaCacheService({
    fs,
    logger,
    cacheRoot: schemaCacheRoot,
    bundledModule: bundledSchemaModule,
    bundledVersion: readBundledSchemaVersion(),
  });

  const validateService = createValidateService({
    schemaLoader,
    logger,
    schemaCacheService,
  });
  const runtimeProxyService = createRuntimeProxyService({
    network,
    logger,
    defaultRuntimeUrl: extensionConfig.vnextRuntimeUrl,
    allowedBaseUrls: extensionConfig.runtimeAllowedBaseUrls,
    allowRuntimeUrlOverride: extensionConfig.allowRuntimeUrlOverride,
  });

  const quickRunService = createQuickRunService(runtimeProxyService);
  const quickswitcherService = createQuickswitcherService({ fs, logger, projectService });

  // Personal snippets live in the user's home dir; project snippets
  // live alongside the project sources. Same convention as desktop.
  const personalSnippetsRoot = join(homedir(), '.vnext-studio', 'snippets').replace(/\\/g, '/');
  const snippetsService = createSnippetsService({
    fs,
    logger,
    projectService,
    personalRoot: personalSnippetsRoot,
  });

  // Sessions live in the OS-canonical app-data location, never in the
  // project tree.
  const personalSessionsRoot = join(userDataDir, 'sessions').replace(/\\/g, '/');
  const sessionsService = createSessionsService({
    fs,
    logger,
    projectService,
    personalRoot: personalSessionsRoot,
  });
  const testDataService = createTestDataService({ fs, logger, projectService });

  // QuickRun presets share the user-data dir with sessions.
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
