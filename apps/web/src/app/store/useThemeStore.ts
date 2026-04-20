import { create } from 'zustand';

/**
 * Web-only theme preference. The VS Code extension shell does NOT use this:
 * its webview inherits VS Code's CSS variables (`--vscode-*`) and follows
 * the editor theme automatically, so theming there is the host's job.
 *
 * The web SPA mirrors the active value onto `<html data-theme>` and uses
 * Tailwind tokens to drive the actual look.
 */
export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
}));
