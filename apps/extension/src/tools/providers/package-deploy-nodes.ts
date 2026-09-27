import type { WfCliInfo } from '../wf-cli-probe.js';

export type DeployCommandId = 'wfUpdateAll' | 'wfUpdate' | 'wfCsxAll';
export type DeployNodeId = DeployCommandId | 'installWfCli' | 'publishCompletedInfo';

export const DEPLOY_COMMAND_IDS: readonly DeployCommandId[] = ['wfUpdateAll', 'wfUpdate', 'wfCsxAll'];

export const PUBLISH_COMPLETED_NOTICE =
  'This CLI does not signal publish-completed; the runtime discovery cache may stay stale.';

/** Package Deploy tree roots for the probed CLI. */
export function packageDeployNodeIds(info: WfCliInfo): DeployNodeId[] {
  if (!info.installed) return ['installWfCli'];
  return info.supportsPublishCompleted
    ? [...DEPLOY_COMMAND_IDS]
    : [...DEPLOY_COMMAND_IDS, 'publishCompletedInfo'];
}
