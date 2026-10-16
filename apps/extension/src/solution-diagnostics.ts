import * as vscode from 'vscode';

import {
  missingDomainIssue,
  resolveSolutionForComponent,
  scanSchemaRoleIssues,
  scanVnextComponents,
  type FileSystemAdapter,
  type SchemaRoleIssue,
  type SolutionIssue,
} from '@vnext-forge-studio/services-core';

import { baseLogger } from './shared/logger.js';
import { summarizeSolutionIssues } from './solution-issues-summary.js';
import type { VnextWorkspaceRoot } from './workspace-detector.js';

const OPEN_PROBLEMS_ACTION = 'Open Problems';
const REVIEW_FIXES_ACTION = 'Review Fixes';

/** Command that reviews and applies the legacy `attributes.type` fixes (see `schema-role-fixes.ts`). */
export const FIX_LEGACY_SCHEMA_TYPES_COMMAND = 'vnextForge.fixLegacySchemaTypes';

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
  private schemaRoleIssues: SchemaRoleIssue[] = [];
  private lastSummaryKey = '';
  private lastLegacyKey = '';
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
    const nextRoleIssues: SchemaRoleIssue[] = [];
    for (const root of roots) {
      try {
        const solutions = root.solutions.flatMap((solution) =>
          solution.status.status === 'ok' && solution.config
            ? [{ paths: solution.config.paths, schemaVersion: solution.config.schemaVersion }]
            : [],
        );
        nextRoleIssues.push(...(await scanSchemaRoleIssues(fsAdapter, root.folderPath, solutions)));
      } catch (error) {
        baseLogger.warn(
          { folder: root.folderPath, error: (error as Error).message },
          'Schema role scan failed for workspace root',
        );
      }
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
    this.schemaRoleIssues = nextRoleIssues;
    this.render();
    this.maybeNotifyLegacySchemaTypes();
  }

  /** Schema-role issues from the latest scan (legacy types and role mismatches). */
  getSchemaRoleIssues(): readonly SchemaRoleIssue[] {
    return this.schemaRoleIssues;
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
    for (const issue of this.schemaRoleIssues) {
      const range = issue.range
        ? new vscode.Range(
            issue.range.start.line,
            issue.range.start.character,
            issue.range.end.line,
            issue.range.end.character,
          )
        : new vscode.Range(0, 0, 0, 0);
      const diagnostic = new vscode.Diagnostic(range, issue.message, toSeverity(issue.severity));
      diagnostic.code = issue.code;
      diagnostic.source = 'vnext-forge-studio';
      if (issue.related.length > 0) {
        diagnostic.relatedInformation = issue.related.map(
          (related) =>
            new vscode.DiagnosticRelatedInformation(
              new vscode.Location(vscode.Uri.file(related), new vscode.Range(0, 0, 0, 0)),
              'Referenced here',
            ),
        );
      }
      const key = normalizeKey(issue.filePath);
      const list = byFile.get(key) ?? [];
      list.push(diagnostic);
      byFile.set(key, list);
    }

    this.collection.clear();
    for (const [filePath, diagnostics] of byFile) {
      this.collection.set(vscode.Uri.file(filePath), diagnostics);
    }
  }

  /** One notification per distinct set of legacy `attributes.type` files. */
  private maybeNotifyLegacySchemaTypes(): void {
    const legacy = this.schemaRoleIssues.filter((issue) => issue.code === 'component.schemaLegacyType');
    const key = legacy
      .map((issue) => issue.filePath)
      .sort()
      .join('|');
    if (key === this.lastLegacyKey) return;
    this.lastLegacyKey = key;
    if (legacy.length === 0) return;
    const message =
      legacy.length === 1
        ? '1 schema uses a legacy attributes.type that vnext-schema 0.0.56 rejects.'
        : `${legacy.length} schemas use a legacy attributes.type that vnext-schema 0.0.56 rejects.`;
    void vscode.window.showWarningMessage(message, REVIEW_FIXES_ACTION, OPEN_PROBLEMS_ACTION).then((action) => {
      if (action === REVIEW_FIXES_ACTION) void vscode.commands.executeCommand(FIX_LEGACY_SCHEMA_TYPES_COMMAND);
      if (action === OPEN_PROBLEMS_ACTION) void vscode.commands.executeCommand('workbench.actions.view.problems');
    });
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
