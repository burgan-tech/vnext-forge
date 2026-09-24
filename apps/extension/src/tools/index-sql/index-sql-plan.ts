import * as path from 'node:path';

import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { isValidWfFlowKey, type VnextSolutionFile } from '@vnext-forge-studio/services-core';

import type { WfCliInfo } from '../wf-cli-probe.js';

/**
 * Pure decisions behind the Forge Tools "Database" view (`wf indexes generate`).
 * No `vscode` import — the glue lives in `providers/database-provider.ts`.
 */

export type DatabaseNodeId = 'generateIndexSqlAll' | 'generateIndexSqlForFlow' | 'installWfCli' | 'updateWfCli';

export function databaseNodeIds(info: WfCliInfo): DatabaseNodeId[] {
  if (!info.installed) return ['installWfCli'];
  if (!info.supportsIndexes) return ['updateWfCli'];
  return ['generateIndexSqlAll', 'generateIndexSqlForFlow'];
}

export type IndexSqlSolution = VnextSolutionFile & { config: NonNullable<VnextSolutionFile['config']> };

export type IndexSqlSolutionCheck =
  | { kind: 'ready'; solution: IndexSqlSolution }
  | { kind: 'pickSolution'; solutions: IndexSqlSolution[] }
  | { kind: 'nonDefault'; chosen: IndexSqlSolution; fallback: IndexSqlSolution }
  | { kind: 'noDefault' };

function isUsableSolution(solution: VnextSolutionFile): solution is IndexSqlSolution {
  return solution.status.status === 'ok' && !!solution.config;
}

/**
 * `wf indexes generate` reads only `vnext.config.json` in cwd and ignores
 * `--domain`, so only the default solution can be processed. With several
 * valid solutions the user picks one first (`pickSolution`); picking a
 * domain-suffixed one yields `nonDefault` so the caller can warn and offer the
 * default instead.
 */
export function checkIndexSqlSolution(
  solutions: readonly VnextSolutionFile[],
  chosenFileName?: string,
): IndexSqlSolutionCheck {
  const usable = solutions.filter(isUsableSolution);
  const fallback = usable.find((solution) => solution.isDefault);
  if (!fallback) return { kind: 'noDefault' };
  if (chosenFileName === undefined) {
    return usable.length > 1 ? { kind: 'pickSolution', solutions: usable } : { kind: 'ready', solution: fallback };
  }
  const wanted = chosenFileName.toLowerCase();
  const chosen = usable.find((solution) => solution.fileName.toLowerCase() === wanted);
  if (!chosen || chosen.isDefault) return { kind: 'ready', solution: fallback };
  return { kind: 'nonDefault', chosen, fallback };
}

export interface IndexSqlFlow {
  key: string;
  path: string;
}

/**
 * Local workflows the CLI would accept for `--flow`: `sys-flows` components of
 * the solution's domain whose key passes the CLI flow-key rule.
 */
export function listIndexSqlFlows(workflows: readonly DiscoveredVnextComponent[], domain: string): IndexSqlFlow[] {
  const byKey = new Map<string, IndexSqlFlow>();
  for (const row of workflows) {
    if (row.flow !== 'sys-flows' || row.domain !== domain || !isValidWfFlowKey(row.key)) continue;
    if (!byKey.has(row.key)) byKey.set(row.key, { key: row.key, path: row.path });
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** The CLI prints an absolute batch path; a relative one is resolved against the run folder. */
export function resolveIndexSqlBatch(cwd: string, batchPath: string): { batchDir: string; readmePath: string } {
  const batchDir = path.resolve(cwd, batchPath);
  return { batchDir, readmePath: path.join(batchDir, 'README.txt') };
}

export const NO_DEFAULT_SOLUTION_MESSAGE =
  'Index SQL generation needs a valid vnext.config.json in the workspace root: the Workflow CLI only processes the default solution.';

export const RETIRE_OBSOLETE_WARNING =
  'Retiring obsolete projections requires every still-active workflow version to be present locally and ' +
  'runtime readers/writers to be drained during the maintenance. Stored values and columns are kept. Continue?';

export function nonDefaultSolutionWarning(chosen: IndexSqlSolution, fallback: IndexSqlSolution): string {
  return (
    `The Workflow CLI only processes the default solution (vnext.config.json, domain "${fallback.config.domain}"). ` +
    `${chosen.fileName} (domain "${chosen.config.domain}") is not included. ` +
    `Generate index SQL for "${fallback.config.domain}" instead?`
  );
}

export function indexSqlSuccessMessage(count: number, batchDir: string, cwd: string): string {
  const relative = path.relative(cwd, batchDir);
  const shown = relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : batchDir;
  return `Generated ${count} SQL file(s) in ${shown}. Nothing was executed; hand the batch to your DBA for review.`;
}
