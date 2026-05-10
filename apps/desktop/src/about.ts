import { app, dialog, BrowserWindow } from 'electron';

const PRODUCT_NAME = 'vnext-forge-studio';
const COPYRIGHT = 'Copyright © 2025 Burgan Tech';

/**
 * Shows a native About dialog with version, runtime, and platform info.
 *
 * On macOS the standard "About vnext-forge-studio" item under the App menu
 * routes here; on Windows/Linux the entry sits in the Help menu. On macOS we
 * also synchronise `app.setAboutPanelOptions` so the OS-managed pane (e.g.
 * triggered by other system gestures) shows the same metadata.
 */
export function showAboutDialog(): void {
  const version = app.getVersion();
  const electronVersion = process.versions.electron;
  const chromeVersion = process.versions.chrome;
  const nodeVersion = process.versions.node;
  const platform = `${process.platform} ${process.arch}`;

  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: PRODUCT_NAME,
      applicationVersion: version,
      version: `Electron ${electronVersion}`,
      copyright: COPYRIGHT,
    });
    app.showAboutPanel();
    return;
  }

  const detail = [
    `Version: ${version}`,
    `Electron: ${electronVersion}`,
    `Chromium: ${chromeVersion}`,
    `Node.js: ${nodeVersion}`,
    `Platform: ${platform}`,
    '',
    COPYRIGHT,
  ].join('\n');

  void dialog.showMessageBox(BrowserWindow.getFocusedWindow() ?? undefined!, {
    type: 'info',
    title: `About ${PRODUCT_NAME}`,
    message: PRODUCT_NAME,
    detail,
    buttons: ['OK'],
    defaultId: 0,
  });
}
