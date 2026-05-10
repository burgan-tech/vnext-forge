/**
 * Local type mirror for the `quickswitcher/buildIndex` response shape.
 *
 * Kept in sync with `packages/services-core/src/services/quickswitcher/quickswitcher-schemas.ts`.
 * designer-ui never imports from services-core directly (browser bundle / Node
 * separation), so we duplicate the small contract here. If the backend shape
 * changes, update both files together.
 */

export type QuickSwitchEntryType =
  | 'workflow'
  | 'state'
  | 'transition'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension';

export interface QuickSwitchEntry {
  id: string;
  type: QuickSwitchEntryType;
  label: string;
  description?: string;
  componentKey: string;
  domain?: string;
  version?: string;
  flow: string;
  filePath: string;
  stateKey?: string;
  transitionKey?: string;
}

export interface QuickswitcherIndexResult {
  entries: QuickSwitchEntry[];
  warnings: string[];
}
