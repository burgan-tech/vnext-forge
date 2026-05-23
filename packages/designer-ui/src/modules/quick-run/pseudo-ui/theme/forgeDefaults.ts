/**
 * Forge default PrimeReact token overrides (Layer 2 in the R10 theme
 * stack — see `buildSheets.ts`).
 *
 * Spec reference: forgepseudouithemingspec.md §4.1 ("Forge default
 * token JSON"). The values below are the spec's M3 indigo baseline.
 * Exact colors should be confirmed against the Forge design palette
 * before any visual sign-off — the structure is what matters for
 * code review.
 *
 * Forge layers these tokens AFTER the static MDC PrimeReact theme so
 * they win cascade order. Then the tenant override (if any) is
 * adopted last for the final say.
 */
export type AppTheme = 'light' | 'dark';

export type ForgeDefaultTokens = Readonly<Record<string, string>>;

export const FORGE_DEFAULT_TOKENS: Readonly<Record<AppTheme, ForgeDefaultTokens>> = Object.freeze({
  light: Object.freeze({
    '--p-primary-color': '#6750A4',
    '--p-primary-50': 'rgba(103, 80, 164, 0.05)',
    '--p-primary-100': 'rgba(103, 80, 164, 0.12)',
    '--p-surface-0': '#FFFFFF',
    '--p-surface-100': '#F5F5F5',
    '--p-surface-200': '#E0E0E0',
    '--p-text-color': 'rgba(0, 0, 0, 0.87)',
    '--p-text-muted-color': 'rgba(0, 0, 0, 0.60)',
  }),
  dark: Object.freeze({
    '--p-primary-color': '#D0BCFF',
    '--p-primary-50': 'rgba(208, 188, 255, 0.08)',
    '--p-primary-100': 'rgba(208, 188, 255, 0.16)',
    '--p-surface-0': '#1C1B1F',
    '--p-surface-100': '#2B2930',
    '--p-surface-200': '#49454F',
    '--p-text-color': 'rgba(255, 255, 255, 0.87)',
    '--p-text-muted-color': 'rgba(255, 255, 255, 0.60)',
  }),
});
