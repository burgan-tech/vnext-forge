export interface DefinitionListItem {
  id: string;
  name: string;
  version: string;
  type?: string;
  taskType?: string;
  deprecated?: boolean;
  returnType?: string;
  parameterCount?: number;
  description?: string;
  usedBy?: string[];
}
