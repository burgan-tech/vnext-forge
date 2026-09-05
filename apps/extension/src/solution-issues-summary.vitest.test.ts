import { describe, expect, it } from 'vitest';

import type { SolutionIssue } from '@vnext-forge-studio/services-core';

import { summarizeSolutionIssues } from './solution-issues-summary.js';

const issue = (
  code: SolutionIssue['code'],
  filePath: string,
  severity: SolutionIssue['severity'] = 'error',
): SolutionIssue => ({ code, severity, message: code, filePath });

describe('summarizeSolutionIssues', () => {
  it('returns undefined when there are no errors or warnings', () => {
    expect(summarizeSolutionIssues([])).toBeUndefined();
    expect(
      summarizeSolutionIssues([issue('solution.packageJsonMissing', '/ws/vnext.config.json', 'info')]),
    ).toBeUndefined();
  });

  it('counts problems and distinct files, listing file names alphabetically', () => {
    const summary = summarizeSolutionIssues([
      issue('solution.invalidJson', '/ws/vnext.zeta.config.json'),
      issue('solution.domainMismatch', '/ws/vnext.alpha.config.json', 'warning'),
      issue('solution.duplicateDomain', '/ws/vnext.alpha.config.json'),
      issue('solution.packageJsonMissing', '/ws/vnext.config.json', 'info'),
    ]);
    expect(summary?.problemCount).toBe(3);
    expect(summary?.fileCount).toBe(2);
    expect(summary?.message).toBe(
      'vNext Forge: 3 problems in 2 solution files (vnext.alpha.config.json, vnext.zeta.config.json).',
    );
  });

  it('uses singular wording for one problem in one file', () => {
    const summary = summarizeSolutionIssues([issue('solution.invalidJson', 'C:\\ws\\vnext.config.json')]);
    expect(summary?.message).toBe('vNext Forge: 1 problem in 1 solution file (vnext.config.json).');
  });

  it('produces a stable key independent of issue order and path separators', () => {
    const a = summarizeSolutionIssues([
      issue('solution.invalidJson', '/ws/vnext.config.json'),
      issue('solution.duplicateDomain', '/ws/vnext.b.config.json'),
    ]);
    const b = summarizeSolutionIssues([
      issue('solution.duplicateDomain', '\\ws\\vnext.b.config.json'),
      issue('solution.invalidJson', '\\ws\\vnext.config.json'),
    ]);
    expect(a?.key).toBe(b?.key);
    const c = summarizeSolutionIssues([issue('solution.invalidJson', '/ws/vnext.config.json')]);
    expect(c?.key).not.toBe(a?.key);
  });
});
