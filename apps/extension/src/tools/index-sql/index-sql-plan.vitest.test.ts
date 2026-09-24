import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type { VnextSolutionFile } from '@vnext-forge-studio/services-core';

import { WF_CLI_NOT_INSTALLED, type WfCliInfo } from '../wf-cli-probe.js';
import {
  checkIndexSqlSolution,
  databaseNodeIds,
  indexSqlSuccessMessage,
  isIndexSqlBatchInsideRoot,
  listIndexSqlFlows,
  nonDefaultSolutionWarning,
  resolveIndexSqlBatch,
  type IndexSqlSolution,
} from './index-sql-plan.js';

type SolutionConfig = NonNullable<VnextSolutionFile['config']>;

function solution(fileName: string, domain: string, ok = true): VnextSolutionFile {
  const isDefault = fileName === 'vnext.config.json';
  const config = { domain, paths: { componentsRoot: domain } } as unknown as SolutionConfig;
  return {
    fileName,
    filePath: `/ws/${fileName}`,
    rootPath: '/ws',
    isDefault,
    ...(isDefault ? {} : { domainFromFileName: domain }),
    ...(ok
      ? { status: { status: 'ok' as const, config }, config }
      : { status: { status: 'invalid' as const, message: 'bad json' } }),
  };
}

const cli = (supportsIndexes: boolean): WfCliInfo => ({
  installed: true,
  version: supportsIndexes ? '1.1.0' : '1.0.13',
  supportsDomainFlag: true,
  supportsIndexes,
  supportsPublishCompleted: supportsIndexes,
});

describe('databaseNodeIds', () => {
  it('asks to install, then to update, then offers both actions', () => {
    expect(databaseNodeIds(WF_CLI_NOT_INSTALLED)).toEqual(['installWfCli']);
    expect(databaseNodeIds(cli(false))).toEqual(['updateWfCli']);
    expect(databaseNodeIds(cli(true))).toEqual(['generateIndexSqlAll', 'generateIndexSqlForFlow']);
  });
});

describe('checkIndexSqlSolution', () => {
  const core = solution('vnext.config.json', 'core');
  const partner = solution('vnext.partner.config.json', 'partner');

  it('is ready with only the default solution', () => {
    expect(checkIndexSqlSolution([core])).toEqual({ kind: 'ready', solution: core });
    expect(checkIndexSqlSolution([core, solution('vnext.broken.config.json', 'broken', false)])).toEqual({
      kind: 'ready',
      solution: core,
    });
  });

  it('refuses a root without a valid vnext.config.json', () => {
    expect(checkIndexSqlSolution([partner])).toEqual({ kind: 'noDefault' });
    expect(checkIndexSqlSolution([solution('vnext.config.json', 'core', false), partner])).toEqual({
      kind: 'noDefault',
    });
  });

  it('asks for a solution when several are valid', () => {
    expect(checkIndexSqlSolution([core, partner])).toEqual({ kind: 'pickSolution', solutions: [core, partner] });
  });

  it('flags a chosen domain-suffixed solution and offers the default instead', () => {
    expect(checkIndexSqlSolution([core, partner], 'VNEXT.PARTNER.CONFIG.JSON')).toEqual({
      kind: 'nonDefault',
      chosen: partner,
      fallback: core,
    });
    expect(checkIndexSqlSolution([core, partner], 'vnext.config.json')).toEqual({ kind: 'ready', solution: core });
  });

  it('words the multi-domain warning around the default solution', () => {
    expect(nonDefaultSolutionWarning(partner as IndexSqlSolution, core as IndexSqlSolution)).toBe(
      'The Workflow CLI only processes the default solution (vnext.config.json, domain "core"). ' +
        'vnext.partner.config.json (domain "partner") is not included. Generate index SQL for "core" instead?',
    );
  });
});

describe('listIndexSqlFlows', () => {
  const row = (key: string, domain: string | undefined, flow = 'sys-flows'): DiscoveredVnextComponent => ({
    key,
    path: `/ws/core/Workflows/${key}.json`,
    flow,
    ...(domain ? { domain } : {}),
  });

  it('keeps valid local workflow keys of the domain, sorted and unique', () => {
    expect(
      listIndexSqlFlows(
        [
          row('money-transfer', 'core'),
          row('account-opening', 'core'),
          row('account-opening', 'core'),
          row('partner-flow', 'partner'),
          row('no-domain', undefined),
          row('1-bad-key', 'core'),
          row('some-task', 'core', 'sys-tasks'),
        ],
        'core',
      ),
    ).toEqual([
      { key: 'account-opening', path: '/ws/core/Workflows/account-opening.json' },
      { key: 'money-transfer', path: '/ws/core/Workflows/money-transfer.json' },
    ]);
  });
});

describe('batch paths and copy', () => {
  it('resolves the batch folder against the run folder and points at README.txt', () => {
    expect(resolveIndexSqlBatch('/ws', '/ws/index-sql/b1')).toEqual({
      batchDir: path.resolve('/ws/index-sql/b1'),
      readmePath: path.join(path.resolve('/ws/index-sql/b1'), 'README.txt'),
    });
    expect(resolveIndexSqlBatch('/ws', 'index-sql/b2').batchDir).toBe(path.resolve('/ws', 'index-sql/b2'));
  });

  it('shows the batch relative to the workspace when it is inside it', () => {
    expect(indexSqlSuccessMessage(3, path.resolve('/ws/index-sql/b1'), path.resolve('/ws'))).toBe(
      `Generated 3 SQL file(s) in ${path.join('index-sql', 'b1')}. Nothing was executed; hand the batch to your DBA for review.`,
    );
    expect(indexSqlSuccessMessage(1, path.resolve('/elsewhere/b'), path.resolve('/ws'))).toBe(
      `Generated 1 SQL file(s) in ${path.resolve('/elsewhere/b')}. Nothing was executed; hand the batch to your DBA for review.`,
    );
  });

  it('flags whether the batch folder is inside the workspace root', () => {
    expect(isIndexSqlBatchInsideRoot(path.resolve('/ws'), path.resolve('/ws/index-sql/b1'))).toBe(true);
    expect(isIndexSqlBatchInsideRoot(path.resolve('/ws'), path.resolve('/elsewhere/b'))).toBe(false);
    expect(isIndexSqlBatchInsideRoot(path.resolve('/ws'), path.resolve('/ws2/index-sql/b1'))).toBe(false);
  });
});
