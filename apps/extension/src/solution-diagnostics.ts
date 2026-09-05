import * as vscode from 'vscode';

import {
  missingDomainIssue,
  resolveSolutionForComponent,
  scanVnextComponents,
  type FileSystemAdapter,
  type SolutionIssue,
} from '@vnext-forge-studio/services-core';

import { baseLogger } from './shared/logger.js';
import { summarizeSolutionIssues } from './solution-issues-summary.js';
import type { VnextWorkspaceRoot } from './workspace-detector.js';

const OPEN_PROBLEMS_ACTION = 'Open Problems';

function toSeverity(severity: SolutionIssue['severity']): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

/**
 * Publishes solution-file validation results to the Problems panel and shows
 * one aggregated notification per distinct problem set.
 *
 * Owns its own `DiagnosticCollection`: the `MessageRouter` collection is
 * rebuilt wholesale on every `host:diagnostics` frame from the webview, so
 * sharing it would wipe these entries on the next editor validation.
 */
export class SolutionDiagnosticsPublisher implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection(
    'vnext-forge-studio:solutions',
  );
  private solutionIssues: SolutionIssue[] = [];
  private componentIssues = new Map<string, SolutionIssue[]>();
  private lastSummaryKey = '';
  private scanGeneration = 0;

  /** Replace solution-level issues (called on every detector refresh). */
  publish(roots: readonly VnextWorkspaceRoot[]): void {
    this.solutionIssues = roots.flatMap((root) => root.issues);
    this.componentIssues.clear();
    this.render();
    this.maybeNotify();
  }

  /** Replace the component-level issues for one file (e.g. after opening/running it). */
  setComponentIssues(filePath: string, issues: readonly SolutionIssue[]): void {
    const key = normalizeKey(filePath);
    if (issues.length === 0) this.componentIssues.delete(key);
    else this.componentIssues.set(key, [...issues]);
    this.render();
  }

  /**
   * Background pass: walk every valid solution's component folders and flag
   * components whose `$.domain` does not match a solution or whose file lives
   * under another solution's `componentsRoot`. Never blocks activation; a
   * newer refresh supersedes an in-flight scan.
   */
  async scanComponents(roots: readonly VnextWorkspaceRoot[], fsAdapter: FileSystemAdapter): Promise<void> {
    const generation = ++this.scanGeneration;
    const next = new Map<string, SolutionIssue[]>();
    for (const root of roots) {
      for (const solution of root.solutions) {
        if (solution.status.status !== 'ok' || !solution.config) continue;
        try {
          const { components } = await scanVnextComponents(fsAdapter, root.folderPath, solution.config.paths);
          for (const bucket of Object.values(components)) {
            for (const component of bucket) {
              if (!component.domain) {
                // The Workflow CLI (≥ 1.0.13) skips these with DOMAIN_MISMATCH.
                next.set(normalizeKey(component.path), [missingDomainIssue(component.path, solution)]);
                continue;
              }
              const { issues } = resolveSolutionForComponent(root.solutions, component.domain, component.path);
              if (issues.length > 0) next.set(normalizeKey(component.path), issues);
            }
          }
        } catch (error) {
          baseLogger.warn(
            { folder: root.folderPath, file: solution.fileName, error: (error as Error).message },
            'Component domain scan failed for solution',
          );
        }
      }
    }
    if (generation !== this.scanGeneration) return;
    this.componentIssues = next;
    this.render();
  }

  dispose(): void {
    this.collection.dispose();
  }

  private render(): void {
    const byFile = new Map<string, vscode.Diagnostic[]>();
    const push = (issue: SolutionIssue) => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        issue.message,
        toSeverity(issue.severity),
      );
      diagnostic.code = issue.code;
      diagnostic.source = 'vnext-forge-studio';
      if (issue.related && issue.related.length > 0) {
        diagnostic.relatedInformation = issue.related.map(
          (related) =>
            new vscode.DiagnosticRelatedInformation(
              new vscode.Location(vscode.Uri.file(related), new vscode.Range(0, 0, 0, 0)),
              'Related solution file',
            ),
        );
      }
      const key = normalizeKey(issue.filePath);
      const list = byFile.get(key) ?? [];
      list.push(diagnostic);
      byFile.set(key, list);
    };
    for (const issue of this.solutionIssues) push(issue);
    for (const issues of this.componentIssues.values()) for (const issue of issues) push(issue);

    this.collection.clear();
    for (const [filePath, diagnostics] of byFile) {
      this.collection.set(vscode.Uri.file(filePath), diagnostics);
    }
  }

  private maybeNotify(): void {
    const summary = summarizeSolutionIssues(this.solutionIssues);
    if (!summary) {
      this.lastSummaryKey = '';
      return;
    }
    if (summary.key === this.lastSummaryKey) return;
    this.lastSummaryKey = summary.key;
    void vscode.window.showWarningMessage(summary.message, OPEN_PROBLEMS_ACTION).then((action) => {
      if (action === OPEN_PROBLEMS_ACTION) {
        void vscode.commands.executeCommand('workbench.actions.view.problems');
      }
    });
  }
}

function normalizeKey(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
