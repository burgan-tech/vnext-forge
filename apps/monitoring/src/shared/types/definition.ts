export type DefinitionType =
  | 'workflow'
  | 'task'
  | 'function'
  | 'view'
  | 'extension'
  | 'schema'
  | 'mapping';

export interface TaskDefinition {
  id: string;
  name: string;
  taskType: 'Http' | 'Script';
  version: string;
  deprecated?: boolean;
  description: string;
}

export interface FunctionDefinition {
  id: string;
  name: string;
  returnType: string;
  version: string;
  parameters: { name: string; type: string; required: boolean }[];
}

export interface ViewDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface ExtensionDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface SchemaDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface MappingDefinition {
  id: string;
  name: string;
  version: string;
  usedBy: string[];
}
