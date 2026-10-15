import * as path from 'node:path';
import * as vscode from 'vscode';

import { schemaTypeTextEdit, type SchemaRoleIssue } from '@vnext-forge-studio/services-core';

import { FIX_LEGACY_SCHEMA_TYPES_COMMAND } from './solution-diagnostics.js';

const LEGACY_CODE = 'component.schemaLegacyType';
const FIXABLE_CODES = new Set<string>([LEGACY_CODE, 'component.schemaRoleMismatch']);

export interface SchemaRoleIssueSource {
  getSchemaRoleIssues(): readonly SchemaRoleIssue[];
}

function normalize(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function fixTitle(value: string): string {
  return value === '' ? 'Remove attributes.type (no schema role)' : `Set attributes.type to "${value}"`;
}

/** Adds the edit for `value` on `document` to `edit`; false when the file has no `attributes.type`. */
function addFixEdit(edit: vscode.WorkspaceEdit, document: vscode.TextDocument, value: SchemaRoleIssue['fix']): boolean {
  if (!value) return false;
  const textEdit = schemaTypeTextEdit(document.getText(), value.value);
  if (!textEdit) return false;
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(textEdit.start), document.positionAt(textEdit.end)),
    textEdit.newText,
  );
  return true;
}

/**
 * Quick fixes for the schema-role diagnostics: set the inferred role (or
 * remove a legacy type), plus an entry into the reviewed "fix all" command.
 */
export class SchemaRoleCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(private readonly issues: SchemaRoleIssueSource) {}

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const filePath = normalize(document.uri.fsPath);
    const all = this.issues.getSchemaRoleIssues();
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'vnext-forge-studio' || !FIXABLE_CODES.has(String(diagnostic.code))) continue;
      const issue = all.find((candidate) => candidate.code === diagnostic.code && normalize(candidate.filePath) === filePath);
      if (!issue?.fix) continue;
      const edit = new vscode.WorkspaceEdit();
      if (!addFixEdit(edit, document, issue.fix)) continue;
      const action = new vscode.CodeAction(fixTitle(issue.fix.value), vscode.CodeActionKind.QuickFix);
      action.edit = edit;
      action.diagnostics = [diagnostic];
      action.isPreferred = issue.code === LEGACY_CODE;
      actions.push(action);

      if (issue.code === LEGACY_CODE && all.filter((candidate) => candidate.code === LEGACY_CODE).length > 1) {
        const fixAll = new vscode.CodeAction('Review all legacy schema type fixes…', vscode.CodeActionKind.QuickFix);
        fixAll.command = { command: FIX_LEGACY_SCHEMA_TYPES_COMMAND, title: fixAll.title };
        fixAll.diagnostics = [diagnostic];
        actions.push(fixAll);
      }
    }
    return actions;
  }
}

interface FixPickItem extends vscode.QuickPickItem {
  issue: SchemaRoleIssue;
}

/**
 * Lists every legacy `attributes.type` with its planned fix; the user picks
 * which to apply (all preselected). Applies one workspace edit and saves the
 * changed files so the next scan sees them.
 */
export async function reviewLegacySchemaTypeFixes(source: SchemaRoleIssueSource): Promise<void> {
  const legacy = source.getSchemaRoleIssues().filter((issue) => issue.code === LEGACY_CODE && issue.fix);
  if (legacy.length === 0) {
    void vscode.window.showInformationMessage('vnext-forge-studio: No legacy schema types to fix.');
    return;
  }

  const items: FixPickItem[] = legacy.map((issue) => ({
    label: path.basename(issue.filePath),
    description: issue.fix!.value === '' ? 'remove attributes.type' : `→ ${issue.fix!.value}`,
    detail: vscode.workspace.asRelativePath(issue.filePath),
    picked: true,
    issue,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: 'Fix legacy schema types',
    placeHolder: 'Roles are inferred from where each schema is referenced. Uncheck any you want to keep.',
    ignoreFocusOut: true,
  });
  if (!picked || picked.length === 0) return;

  const edit = new vscode.WorkspaceEdit();
  const changed: vscode.TextDocument[] = [];
  for (const { issue } of picked) {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(issue.filePath));
    if (addFixEdit(edit, document, issue.fix)) changed.push(document);
  }
  if (changed.length === 0) return;
  if (!(await vscode.workspace.applyEdit(edit))) {
    void vscode.window.showErrorMessage('vnext-forge-studio: Could not apply the schema type fixes.');
    return;
  }
  await Promise.all(changed.map((document) => document.save()));
  void vscode.window.showInformationMessage(
    `vnext-forge-studio: Updated attributes.type in ${changed.length} schema file${changed.length === 1 ? '' : 's'}.`,
  );
}
