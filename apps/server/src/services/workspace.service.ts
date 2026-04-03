import path from 'node:path'
import {
  CONFIG_FILE,
  WorkspaceAnalyzer,
  resolveComponentPath,
} from '@vnext-studio/workspace-service'
import type {
  WorkspaceAnalysisResult,
  WorkspaceConfig,
  WorkspaceStructure,
} from '@vnext-studio/workspace-service'

export class WorkspaceService {
  private readonly analyzer = new WorkspaceAnalyzer()

  async analyze(rootPath: string, traceId?: string): Promise<WorkspaceAnalysisResult> {
    return this.analyzer.analyze(rootPath, traceId)
  }

  async getConfig(rootPath: string, traceId?: string): Promise<WorkspaceConfig> {
    return this.analyzer.readConfig(rootPath, traceId)
  }

  async getFileTree(rootPath: string, traceId?: string): Promise<WorkspaceStructure> {
    return {
      root: await this.analyzer.buildTree(rootPath, traceId),
    }
  }

  createDefaultConfig(domain: string, description?: string): WorkspaceConfig {
    return {
      domain,
      description,
      version: '1.0.0',
      runtimeVersion: '0.0.33',
      schemaVersion: '0.0.33',
      paths: {
        componentsRoot: domain,
        tasks: 'Tasks',
        views: 'Views',
        functions: 'Functions',
        extensions: 'Extensions',
        workflows: 'Workflows',
        schemas: 'Schemas',
        mappings: 'Mappings',
      },
      exports: {
        functions: [],
        workflows: [],
        tasks: [],
        views: [],
        schemas: [],
        extensions: [],
        visibility: 'private',
        metadata: {},
      },
      dependencies: {
        domains: [],
        npm: [],
      },
      referenceResolution: {
        enabled: true,
        validateOnBuild: true,
        strictMode: false,
      },
    }
  }

  getConfigPath(rootPath: string): string {
    return path.join(rootPath, CONFIG_FILE)
  }

  getComponentPaths(rootPath: string, domain: string): string[] {
    return [
      'Workflows',
      'Mappings',
      'Schemas',
      'Tasks',
      'Views',
      'Functions',
      'Extensions',
    ].map((component) => resolveComponentPath(rootPath, domain, component))
  }
}
