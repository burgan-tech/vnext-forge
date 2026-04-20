import reactDom from 'eslint-plugin-react-dom';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactX from 'eslint-plugin-react-x';

import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'browser',
  extraRules: {
    '@typescript-eslint/no-floating-promises': 'off',
  },
  // Bootstrap-time configuration warnings (e.g. missing .env /
  // VITE_API_BASE_URL) are emitted via console.warn before any logger adapter
  // is wired up. Keep this list as small as possible.
  loggerConsoleFiles: ['src/shared/config/config.ts'],
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      ...reactX.configs['recommended-type-checked'],
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      ...reactDom.configs.recommended,
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      ...reactHooks.configs.flat['recommended-latest'],
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      ...reactRefresh.configs.vite,
    },
  ],
});
