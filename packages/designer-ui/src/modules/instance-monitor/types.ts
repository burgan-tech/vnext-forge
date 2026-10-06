import type { VnextExportCategory } from '@vnext-forge-studio/app-contracts';

import type { WorkflowViewModel } from '../canvas-interaction/readonly/view-types';
import type { InstanceDetailResponse } from '../quick-run/QuickRunApi';
import type { RuntimeErrorLike } from '../quick-run/components/RuntimeErrorBanner';
import type { HistoryTransition } from '../quick-run/types/quickrun.types';

/** Which instance a monitor shows and where its definition lives. */
export interface MonitorTarget {
  domain: string;
  workflowKey: string;
  instanceId: string;
  /** Absolute path of the local workflow JSON. Absent → history-only graph. */
  workflowFilePath?: string;
  /** Project id for component discovery (extension: the workspace folder path). */
  projectId?: string;
  environmentName?: string;
  runtimeUrl?: string;
}

export type DefinitionSource = 'local' | 'history';

export interface MonitorDefinition {
  source: DefinitionSource;
  vm: WorkflowViewModel;
  diagram: Record<string, unknown>;
  /** `version` of the local workflow file, when loaded from disk. */
  localVersion?: string;
}

export interface MonitorLevelData {
  instance: InstanceDetailResponse;
  /** Oldest first. */
  history: HistoryTransition[];
  definition: MonitorDefinition;
  loadedAt: number;
}

export type MonitorSelection = { kind: 'state'; key: string } | { kind: 'transition'; key: string } | null;

export type MonitorLoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; error: RuntimeErrorLike }
  | { kind: 'ready'; data: MonitorLevelData; refreshing: boolean; staleError: RuntimeErrorLike | null };

/** A resolved component reference the host should open in its designer. */
export interface OpenComponentTarget {
  category: VnextExportCategory;
  key: string;
  filePath: string;
}
