import type { ComponentEditorKind } from '@vnext-forge/designer-ui';

import type { FileRouteType } from './FileRouter';

/** FileRouter `type` → sekme / URL segment türü. */
export function fileRouteTypeToComponentKind(type: FileRouteType): ComponentEditorKind | null {
  switch (type) {
    case 'workflow':
      return 'flow';
    case 'task':
      return 'task';
    case 'schema':
      return 'schema';
    case 'view':
      return 'view';
    case 'function':
      return 'function';
    case 'extension':
      return 'extension';
    default:
      return null;
  }
}
