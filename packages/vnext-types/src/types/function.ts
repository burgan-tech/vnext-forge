import { Label } from './label';
import { MappingCode } from './mapping';
import { ResourceReference, TaskExecution } from './state';

export type FunctionScope = 'I' | 'F' | 'D';

export interface FunctionDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  scope?: FunctionScope;
  labels?: Label[];
  tasks?: TaskExecution[];
  mapping?: MappingCode;
  extensions?: ResourceReference[];
}
