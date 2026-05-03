/**
 * Electron preload script.
 *
 * Runs in the renderer context with Node.js access but before the page loads.
 * contextIsolation is enabled — use contextBridge to expose controlled APIs to
 * the renderer if needed in the future.
 *
 * Currently intentionally minimal: the desktop shell serves both the SPA and
 * the API from the same origin (http://127.0.0.1:<port>/), so no runtime URL
 * injection is required. The web app's production config already defaults to
 * same-origin API calls (apiBaseUrl = '').
 */

// No exports needed; the file must exist for BrowserWindow.webPreferences.preload.
export {};
