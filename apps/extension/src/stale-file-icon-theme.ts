import * as vscode from 'vscode';

/**
 * Eski vNext Forge surumlarinda contributes edilen `vnext-forge-icons` File Icon Theme
 * artik pakette yok. `workbench.iconTheme` hala bu id'ye sabitlenmisse ikonlar
 * gorunmeyebilir. Tum kapsamlarda (workspace folder / workspace / user) bu degeri temizler.
 */
const REMOVED_THEME_IDS = new Set(['vnext-forge-icons']);

export async function clearRemovedFileIconThemeIfSet(): Promise<boolean> {
  const wb = vscode.workspace.getConfiguration('workbench');
  const inspected = wb.inspect<string>('iconTheme');
  if (!inspected) {
    return false;
  }

  let didClear = false;
  const clearIfStale = async (
    value: string | undefined,
    target: vscode.ConfigurationTarget,
  ): Promise<void> => {
    if (value && REMOVED_THEME_IDS.has(value)) {
      await wb.update('iconTheme', undefined, target);
      didClear = true;
    }
  };

  await clearIfStale(inspected.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder);
  await clearIfStale(inspected.workspaceValue, vscode.ConfigurationTarget.Workspace);
  await clearIfStale(inspected.globalValue, vscode.ConfigurationTarget.Global);

  return didClear;
}
