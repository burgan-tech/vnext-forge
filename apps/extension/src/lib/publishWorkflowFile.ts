import * as path from 'node:path';

import { buildWfShellCommand, isValidWfDomainName } from '@vnext-forge-studio/services-core';

import type { ForgeTerminalManager } from '../tools/forge-terminal.js';
import type { WfCliInfo, WfCliProbe } from '../tools/wf-cli-probe.js';
import type { VnextWorkspaceDetector } from '../workspace-detector.js';

export interface PublishWorkflowFileParams {
  /** Absolute on-disk path of the component JSON file to publish. */
  filePath: string;
  /** Shared terminal manager (reuses the persistent Forge terminal). */
  terminal: ForgeTerminalManager;
  /** Owning root + solution resolution (`$.domain` first, path second). */
  detector: VnextWorkspaceDetector;
  /** Installed Workflow CLI facts (version, `--domain` support). */
  wfCli: WfCliProbe;
  /** Called when the legacy `wf domain use … &&` form had to be used. */
  onLegacyCli?: (info: WfCliInfo) => void;
  /** Optional logger — receives diagnostic warnings (workspace miss, etc.). */
  logger?: { warn(data: Record<string, unknown>, message?: string): void };
}

export interface PublishWorkflowFileResult {
  ok: boolean;
  /** Human-readable reason when `ok=false` (returned to the caller for
   *  user-facing error notifications). */
  reason?: string;
}

/**
 * Single entry-point for publishing a component JSON to the runtime via
 * `wf update -f <path>`. Called from two surfaces:
 *
 *   1. The webview-side Publish button (`MessageRouter.handlePublishFrame`),
 *      which delivers the file path through the postMessage envelope.
 *   2. The Explorer right-click "Forge: Publish" command, which delivers
 *      the file path through the VS Code menu invocation.
 *
 * Multi-domain rules:
 *   - The command runs from the **owning vNext root** (the folder holding the
 *     solution files), which doubles as the jail check: a path outside every
 *     detected root is refused.
 *   - `--domain <d>` is taken from Forge's own resolution of the component's
 *     solution (`$.domain` primary). If the file sits under another solution's
 *     `componentsRoot`, the CLI prints its own "belongs to domain …" error in
 *     the terminal — deliberately left to the CLI.
 *   - A CLI older than 1.0.13 gets `wf domain use <d> && wf update -f …`.
 *
 * On success: queues the command on the shared Forge terminal and returns.
 * The terminal output is the user-visible feedback.
 */
export async function publishWorkflowFile(
  params: PublishWorkflowFileParams,
): Promise<PublishWorkflowFileResult> {
  const { terminal, detector, wfCli, logger } = params;
  const rawPath = params.filePath?.trim();
  if (!rawPath) {
    return { ok: false, reason: 'No file path provided.' };
  }

  const info = await wfCli.get();
  if (!info.installed) {
    return {
      ok: false,
      reason: 'Workflow CLI (wf) is not installed. Use Forge Tools > Package Deploy > Install Workflow CLI.',
    };
  }

  const normalized = path.normalize(rawPath);
  const root = detector.findOwningRoot(normalized);
  if (!root) {
    logger?.warn({ path: normalized }, 'publishWorkflowFile rejected: path outside every vNext root');
    return {
      ok: false,
      reason:
        'File is not inside a vNext workspace root (no vnext*.config.json found in a parent workspace folder).',
    };
  }

  let domain: string | undefined;
  try {
    const resolved = await detector.resolveSolutionForFile(normalized);
    domain = resolved?.solution.config?.domain;
  } catch (error) {
    logger?.warn({ path: normalized, error: (error as Error).message }, 'publishWorkflowFile: solution resolution failed');
  }
  if (domain && !isValidWfDomainName(domain)) {
    logger?.warn({ path: normalized, domain }, 'publishWorkflowFile: domain is not a usable wf domain name; omitting --domain');
    domain = undefined;
  }
  if (!domain) {
    logger?.warn({ path: normalized }, 'publishWorkflowFile: no solution resolved; letting the CLI route by componentsRoot');
  }

  const command = buildWfShellCommand(
    { base: 'update -f', filePath: rawPath },
    { domain, cliSupportsDomainFlag: info.supportsDomainFlag },
  );
  if (domain && !info.supportsDomainFlag) {
    params.onLegacyCli?.(info);
  }

  terminal.run(command, { cwd: root.folderPath });
  return { ok: true };
}
