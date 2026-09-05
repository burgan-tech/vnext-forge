import * as vscode from 'vscode';

import { WF_DOMAIN_FLAG_MIN_VERSION } from '@vnext-forge-studio/services-core';

import type { WfCliInfo } from './wf-cli-probe.js';

const UPDATE_ACTION = 'Update Workflow CLI';

/**
 * Shown at most once per session, the first time Forge has to fall back to the
 * legacy `wf domain use <domain> && wf …` form because the installed CLI
 * predates the global `--domain` option.
 */
export class WfCliUpgradeNotice {
  private shown = false;

  constructor(private readonly install: () => Promise<void>) {}

  async maybeShow(info: WfCliInfo): Promise<void> {
    if (this.shown) return;
    this.shown = true;
    const version = info.version ?? '(unknown version)';
    const action = await vscode.window.showWarningMessage(
      `Workflow CLI ${version} does not support --domain, so Forge is using the legacy "wf domain use <domain> && …" form. ` +
        `Update to ${WF_DOMAIN_FLAG_MIN_VERSION} or newer.`,
      UPDATE_ACTION,
    );
    if (action === UPDATE_ACTION) {
      await this.install();
    }
  }
}
