import * as path from 'node:path';
import { app, BrowserWindow, shell } from 'electron';
import { findFreePort } from './find-free-port';
import { startServer } from './server-runner';

/**
 * Resolves a path under dist/ whether running from source (development) or
 * from a packaged build (production). electron-builder asarUnpacks the heavy
 * files (server bundle, vendor, webview) so they are real files on disk even
 * when the rest of the app is inside the asar archive.
 *
 *   Development:   apps/desktop/dist/<segments>
 *   Production:    <resources>/app.asar.unpacked/dist/<segments>
 */
function resolveDistAsset(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', ...segments);
  }
  // In development __dirname is apps/desktop/dist/ (CJS bundle output)
  return path.join(__dirname, ...segments);
}

// Enforce single-instance lock — second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let serverKill: (() => void) | null = null;
let serverPort: number | null = null;

async function createWindow(port: number): Promise<void> {
  const preloadPath = resolveDistAsset('preload.js');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'vnext-forge',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Open external links in the system browser, not in the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools automatically in development so the renderer can be
  // inspected without the keyboard shortcut.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  // On macOS it's conventional to leave the app running until Cmd+Q.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS re-create the window when the dock icon is clicked and no windows
  // are open; the server is already running so we reuse its port.
  if (mainWindow === null && serverPort !== null) {
    createWindow(serverPort).catch((err) =>
      console.error('[desktop] failed to reopen window:', err),
    );
  }
});

app.on('will-quit', () => {
  serverKill?.();
});

app.whenReady().then(async () => {
  try {
    const port = await findFreePort();
    const serverBundlePath = resolveDistAsset('server.bundle.js');
    const webviewDir = resolveDistAsset('webview');

    const server = await startServer({ port, webviewDir, serverBundlePath });
    serverKill = server.kill;
    serverPort = port;

    await createWindow(port);
  } catch (err) {
    console.error('[desktop] failed to start:', err);
    app.quit();
  }
});
