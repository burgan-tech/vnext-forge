import { describe, expect, it } from 'vitest';

import { WF_CLI_NOT_INSTALLED, type WfCliInfo } from '../wf-cli-probe.js';
import { packageDeployNodeIds, PUBLISH_COMPLETED_NOTICE } from './package-deploy-nodes.js';

const cli = (version: string, supportsPublishCompleted: boolean): WfCliInfo => ({
  installed: true,
  version,
  supportsDomainFlag: true,
  supportsIndexes: supportsPublishCompleted,
  supportsPublishCompleted,
});

describe('packageDeployNodeIds', () => {
  it('offers only the install node when the CLI is missing', () => {
    expect(packageDeployNodeIds(WF_CLI_NOT_INSTALLED)).toEqual(['installWfCli']);
  });

  it('appends the publish-completed info node for a CLI below 1.0.14', () => {
    expect(packageDeployNodeIds(cli('1.0.13', false))).toEqual([
      'wfUpdateAll',
      'wfUpdate',
      'wfCsxAll',
      'publishCompletedInfo',
    ]);
  });

  it('shows only the deploy actions for a current CLI', () => {
    expect(packageDeployNodeIds(cli('1.0.14', true))).toEqual(['wfUpdateAll', 'wfUpdate', 'wfCsxAll']);
  });

  it('uses the spec wording for the notice', () => {
    expect(PUBLISH_COMPLETED_NOTICE).toBe(
      'This CLI does not signal publish-completed; the runtime discovery cache may stay stale.',
    );
  });
});
