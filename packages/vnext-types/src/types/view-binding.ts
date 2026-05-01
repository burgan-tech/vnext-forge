import type { MappingCode } from './mapping';
import type { ResourceReference } from './state';

/** A view binding with optional rule, used by Transition and State. */
export interface ViewBinding {
  rule?: MappingCode;
  view: ResourceReference;
  loadData?: boolean;
  extensions?: string[];
}
