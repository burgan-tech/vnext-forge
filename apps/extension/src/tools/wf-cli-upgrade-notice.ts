import * as vscode from 'vscode';

import { wfCliUpgradeMessage, type WfCliFeature } from './wf-cli-features.js';
import type { WfCliInfo } from './wf-cli-probe.js';

const UPDATE_ACTION = 'Update Workflow CLI';

/**
 * "Your Workflow CLI is too old for <feature>" notification with an update
 * action. `maybeShow` is for automatic fallbacks (at most once per session and
 * feature); `show` is for an explicit user action that cannot run at all.
 */
export class WfCliUpgradeNotice {
  private readonly shown = new Set<string>();

  constructor(private readonly install: () => Promise<void>) {}

  async maybeShow(info: WfCliInfo, feature: WfCliFeature): Promise<void> {
    if (this.shown.has(feature.featureName)) return;
    this.shown.add(feature.featureName);
    await this.show(info, feature);
  }

  async show(info: WfCliInfo, feature: WfCliFeature): Promise<void> {
    const action = await vscode.window.showWarningMessage(
      wfCliUpgradeMessage(info.version, feature),
      UPDATE_ACTION,
    );
    if (action === UPDATE_ACTION) {
      await this.install();
    }
  }
}
