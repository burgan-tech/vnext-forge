import { createRequire } from 'node:module';

import {
  buildMethodRegistry,
  createProjectService,
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

import { createNodeFileSystemAdapter } from '../adapters/node-file-system.js';
import { createNodeNetworkAdapter } from '../adapters/node-network.js';
import { createNodeProcessAdapter } from '../adapters/node-process.js';
import { createNodeWorkspaceRootResolver } from '../adapters/node-workspace-root.js';

const nodeRequire = createRequire(import.meta.url);

interface VnextSchemaModule {
  getSchema(type: string): Record<string, unknown> | null;
  getAvailableTypes(): string[];
  schemas: Record<string, Record<string, unknown>>;
}

const schemaLoader: VnextSchemaLoader = {
  load(): VnextSchemaModule {
    return nodeRequire('@burgan-tech/vnext-schema') as VnextSchemaModule;
  },
};

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
    defaultRuntimeUrl: process.env.VNEXT_RUNTIME_URL ?? 'http://localhost:4201',
  });

  const services: ServiceRegistry = {
    workspaceService,
    projectService,
    templateService,
    validateService,
    runtimeProxyService,
  };

  return { services, registry: buildMethodRegistry() };
}
