export interface ProjectInfo {
  id: string;
  domain: string;
  description?: string;
  path: string;
  version?: string;
  linked?: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface VnextConfig {
  version: string;
  description?: string;
  domain: string;
  runtimeVersion?: string;
  schemaVersion?: string;
  paths: {
    componentsRoot: string;
    tasks: string;
    views: string;
    functions: string;
    extensions: string;
    workflows: string;
    schemas: string;
    mappings: string;
  };
  exports?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  referenceResolution?: Record<string, unknown>;
}
