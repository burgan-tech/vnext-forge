import { ERROR_CODES, type ApiResponse } from '@vnext-forge-studio/app-contracts';

import { normalizeDefinition } from '../../canvas-interaction/readonly/normalize';
import { loadFlowEditorDocument, type LoadFlowEditorResult } from '../../flow-editor/FlowEditorApi';
import * as QuickRunApi from '../../quick-run/QuickRunApi';
import { summarizeRuntimeError, type RuntimeErrorLike } from '../../quick-run/components/RuntimeErrorBanner';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { diagramPathFor } from '../model/definitionDrift';
import { buildHistoryOnlyDefinition } from '../model/historyGraph';
import type { MonitorDefinition, MonitorLevelData, MonitorTarget } from '../types';

/** Injected so the loader can be tested without a transport. */
export interface MonitorLoaders {
  getInstance: typeof QuickRunApi.getInstance;
  getHistory: typeof QuickRunApi.getHistory;
  loadDefinition: typeof loadFlowEditorDocument;
  now: () => number;
}

export const defaultMonitorLoaders: MonitorLoaders = {
  getInstance: QuickRunApi.getInstance,
  getHistory: QuickRunApi.getHistory,
  loadDefinition: loadFlowEditorDocument,
  now: () => Date.now(),
};

export type MonitorLoadResult =
  | { ok: true; data: MonitorLevelData }
  | { ok: false; notFound: boolean; error: RuntimeErrorLike };

/**
 * Loads one monitor level: the instance, its transition history and its
 * definition, in parallel. Read-only — the diagram file is read, never created.
 */
export async function loadMonitorLevel(
  target: MonitorTarget,
  headers: Record<string, string>,
  loaders: MonitorLoaders = defaultMonitorLoaders,
): Promise<MonitorLoadResult> {
  const scope = {
    domain: target.domain,
    workflowKey: target.workflowKey,
    instanceId: target.instanceId,
    headers,
    ...(target.runtimeUrl ? { runtimeUrl: target.runtimeUrl } : {}),
  };

  const [instanceRes, historyRes, definitionRes] = await Promise.all([
    loaders.getInstance(scope),
    loaders.getHistory(scope),
    target.workflowFilePath
      ? loaders.loadDefinition({
          workflowFilePath: target.workflowFilePath,
          diagramFilePath: diagramPathFor(target.workflowFilePath),
        })
      : Promise.resolve(null),
  ]);

  if (!instanceRes.success) {
    return {
      ok: false,
      notFound:
        instanceRes.error.code === ERROR_CODES.RUNTIME_NOT_FOUND ||
        summarizeRuntimeError(instanceRes.error).httpStatus === 404,
      error: instanceRes.error,
    };
  }
  if (!historyRes.success) return { ok: false, notFound: false, error: historyRes.error };

  const history = historyRes.data.transitions ?? [];
  return {
    ok: true,
    data: {
      instance: instanceRes.data,
      history,
      definition: toDefinition(target.workflowKey, history, definitionRes),
      loadedAt: loaders.now(),
    },
  };
}

function toDefinition(
  workflowKey: string,
  history: HistoryTransition[],
  res: ApiResponse<LoadFlowEditorResult> | null,
): MonitorDefinition {
  if (res?.success) {
    const version = res.data.workflow.version;
    return {
      source: 'local',
      vm: normalizeDefinition(res.data.workflow),
      diagram: res.data.diagram,
      ...(typeof version === 'string' ? { localVersion: version } : {}),
    };
  }
  return {
    source: 'history',
    vm: normalizeDefinition(buildHistoryOnlyDefinition(workflowKey, history)),
    diagram: { nodePos: {} },
  };
}
