import type { SolutionIssue } from '@vnext-forge-studio/services-core';

/**
 * Pure summariser for the one aggregated solution-problems notification.
 * Kept free of `vscode` so it is unit-testable; `SolutionDiagnosticsPublisher`
 * decides when (and whether) to show it.
 */
export interface SolutionIssueSummary {
  /** Stable identity of the problem set — the toast is shown once per distinct key. */
  key: string;
  message: string;
  problemCount: number;
  fileCount: number;
}

function baseName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

export function summarizeSolutionIssues(
  issues: readonly SolutionIssue[],
): SolutionIssueSummary | undefined {
  const relevant = issues.filter((issue) => issue.severity !== 'info');
  if (relevant.length === 0) return undefined;

  const files = [...new Set(relevant.map((issue) => baseName(issue.filePath)))].sort((a, b) =>
    a.localeCompare(b),
  );
  const key = relevant
    .map((issue) => `${issue.code}|${issue.filePath.replace(/\\/g, '/')}`)
    .sort()
    .join('\n');
  const problemCount = relevant.length;
  const fileCount = files.length;
  const message =
    `vNext Forge: ${problemCount} problem${problemCount === 1 ? '' : 's'} in ` +
    `${fileCount} solution file${fileCount === 1 ? '' : 's'} (${files.join(', ')}).`;
  return { key, message, problemCount, fileCount };
}
