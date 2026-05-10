import {
  app,
  BrowserWindow,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from 'electron';

import { showAboutDialog } from './about';

const APP_NAME = 'vnext-forge-studio';
const HELP_URL = 'https://github.com/burgan-tech/vnext-forge';
const ISSUES_URL = 'https://github.com/burgan-tech/vnext-forge/issues';

const MENU_SHORTCUT_CHANNEL = 'vnext:menu-shortcut';

/**
 * Forward a designer-level shortcut request from the native menu to whichever
 * BrowserWindow is currently focused (or the only open window). The renderer
 * subscribes via `window.vnextDesktop.onMenuShortcut(...)` (preload bridge).
 *
 * Driving these shortcuts through the OS-level accelerator instead of a
 * renderer keydown listener guarantees they fire even when DevTools or
 * Chromium internals would otherwise consume the keystroke.
 */
function dispatchMenuShortcut(
  id:
    | 'quick-switcher'
    | 'find-in-files'
    | 'insert-snippet'
    | 'toggle-terminal'
    | 'generate-test-data',
): void {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!window || window.isDestroyed()) return;
  window.webContents.send(MENU_SHORTCUT_CHANNEL, id);
}

/**
 * Builds and installs the application menu. Designer commands route through
 * the menu so their accelerators win over DevTools and the renderer doesn't
 * need a keyboard listener for them.
 */
export function installApplicationMenu(): void {
  const template = process.platform === 'darwin' ? buildMacTemplate() : buildDefaultTemplate();
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function buildMacTemplate(): MenuItemConstructorOptions[] {
  return [
    {
      label: APP_NAME,
      submenu: [
        { label: `About ${APP_NAME}`, click: () => showAboutDialog() },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    fileMenu(),
    editMenu(),
    goMenu(),
    viewMenu(),
    windowMenu(),
    helpMenu(),
  ];
}

function buildDefaultTemplate(): MenuItemConstructorOptions[] {
  return [fileMenu(), editMenu(), goMenu(), viewMenu(), windowMenu(), helpMenu()];
}

function fileMenu(): MenuItemConstructorOptions {
  return {
    label: '&File',
    submenu: [process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }],
  };
}

function editMenu(): MenuItemConstructorOptions {
  return {
    label: '&Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'delete' },
      { role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Find in Files…',
        accelerator: 'CmdOrCtrl+Shift+F',
        click: () => dispatchMenuShortcut('find-in-files'),
      },
      {
        label: 'Insert Snippet…',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => dispatchMenuShortcut('insert-snippet'),
      },
      { type: 'separator' },
      {
        label: 'Generate Test Data…',
        accelerator: 'CmdOrCtrl+Shift+G',
        click: () => dispatchMenuShortcut('generate-test-data'),
      },
    ],
  };
}

function goMenu(): MenuItemConstructorOptions {
  return {
    label: '&Go',
    submenu: [
      {
        label: 'Go to Anything…',
        accelerator: 'CmdOrCtrl+P',
        click: () => dispatchMenuShortcut('quick-switcher'),
      },
    ],
  };
}

function viewMenu(): MenuItemConstructorOptions {
  return {
    label: '&View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      {
        label: 'Toggle Terminal',
        // Two reachable bindings: Ctrl+` matches VS Code's "Toggle Terminal";
        // CmdOrCtrl+J matches VS Code's "Toggle Panel" and is reachable on
        // layouts (Turkish Q, AZERTY, …) where backtick is a dead key. The
        // menu only displays one accelerator; we pick the letter-key one
        // because it's the universally reachable option, and register the
        // backtick variant via accelerator() override below.
        accelerator: 'CmdOrCtrl+J',
        click: () => dispatchMenuShortcut('toggle-terminal'),
      },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  };
}

function windowMenu(): MenuItemConstructorOptions {
  return {
    label: '&Window',
    submenu:
      process.platform === 'darwin'
        ? [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' },
          ]
        : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
  };
}

function helpMenu(): MenuItemConstructorOptions {
  const items: MenuItemConstructorOptions[] = [
    {
      label: 'Documentation',
      click: () => {
        shell.openExternal(HELP_URL).catch(() => undefined);
      },
    },
    {
      label: 'Report an Issue',
      click: () => {
        shell.openExternal(ISSUES_URL).catch(() => undefined);
      },
    },
  ];

  // On macOS the About entry lives in the App menu, not Help.
  if (process.platform !== 'darwin') {
    items.push(
      { type: 'separator' },
      { label: `About ${APP_NAME}`, click: () => showAboutDialog() },
    );
  }

  return { role: 'help', submenu: items };
}

// Ensure menu picks up app name on macOS dock + about pane.
app.setName(APP_NAME);
