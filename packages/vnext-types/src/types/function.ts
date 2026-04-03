import { Label } from '@vnext-types-internal/label';
import { MappingCode } from '@vnext-types-internal/mapping';
import { ResourceReference, TaskExecution } from '@vnext-types-internal/state';

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
