import type { BrowserWindowConstructorOptions } from 'electron';
// electron-window-state has no TS types in the package; declare a minimal shape.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const windowStateKeeper: WindowStateKeeperFactory = require('electron-window-state');

const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

export interface WindowState {
  /** BrowserWindow constructor options merged with restored size/position. */
  windowOptions: BrowserWindowConstructorOptions;
  /**
   * Call once after `new BrowserWindow(...)` so the keeper subscribes to
   * resize/move/close and persists state on next launch.
   */
  manage(window: ManagedBrowserWindow): void;
}

interface ManagedBrowserWindow {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  isMaximized(): boolean;
  isMinimized(): boolean;
  isFullScreen(): boolean;
  getBounds(): { x: number; y: number; width: number; height: number };
}

interface WindowStateKeeperInstance {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  manage(window: ManagedBrowserWindow): void;
  unmanage(): void;
  saveState(window: ManagedBrowserWindow): void;
}

interface WindowStateKeeperOptions {
  defaultWidth: number;
  defaultHeight: number;
  file?: string;
}

type WindowStateKeeperFactory = (options: WindowStateKeeperOptions) => WindowStateKeeperInstance;

/**
 * Loads persisted window bounds from the user's config dir and produces
 * BrowserWindow options ready to pass into the constructor. The returned
 * `manage()` must be invoked once with the new window so subsequent moves and
 * resizes are persisted automatically.
 *
 * Storage location (electron-window-state default):
 *   macOS:   ~/Library/Application Support/<appName>/window-state.json
 *   Windows: %APPDATA%\<appName>\window-state.json
 *   Linux:   ~/.config/<appName>/window-state.json
 */
export function createWindowState(): WindowState {
  const keeper = windowStateKeeper({
    defaultWidth: DEFAULT_WIDTH,
    defaultHeight: DEFAULT_HEIGHT,
    file: 'window-state.json',
  });

  return {
    windowOptions: {
      x: keeper.x,
      y: keeper.y,
      width: keeper.width,
      height: keeper.height,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
    },
    manage(window) {
      keeper.manage(window);
    },
  };
}
