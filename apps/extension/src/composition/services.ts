import {
  buildMethodRegistry,
  createProjectService,
  createQuickRunService,
  createRuntimeProxyService,
  createTemplateService,
  createValidateService,
  createWorkspaceService,
  type LoggerAdapter,
  type MethodRegistry,
  type ServiceRegistry,
  type TemplateInitScriptResolver,
  type VnextSchemaLoader,
} from '@vnext-forge/services-core';

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

  const workspaceService = createWorkspaceService({ fs, logger });
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
  });
  const validateService = createValidateService({ schemaLoader, logger });
  const runtimeProxyService = createRuntimeProxyService({
    network,
    logger,
    defaultRuntimeUrl: extensionConfig.vnextRuntimeUrl,
    allowedBaseUrls: extensionConfig.runtimeAllowedBaseUrls,
    allowRuntimeUrlOverride: extensionConfig.allowRuntimeUrlOverride,
  });

  const quickRunService = createQuickRunService(runtimeProxyService);

  const services: ServiceRegistry = {
    workspaceService,
    projectService,
    templateService,
    validateService,
    runtimeProxyService,
    quickRunService,
  };

  return { services, registry: buildMethodRegistry() };
}
