import { Label } from '@vnext-types-internal/label';
import { TaskExecution } from '@vnext-types-internal/state';

export enum ExtensionType {
  Global = 1,
  GlobalAndRequested = 2,
  DefinedFlows = 3,
  DefinedFlowAndRequested = 4,
}

export enum ExtensionScope {
  GetInstance = 1,
  GetAllInstances = 2,
  Everywhere = 3,
}

export interface ExtensionDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  type?: ExtensionType;
  scope?: ExtensionScope;
  definedFlows?: string[];
  labels?: Label[];
  tasks?: TaskExecution[];
}
