import reactDom from 'eslint-plugin-react-dom';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactX from 'eslint-plugin-react-x';

import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'browser',
  // IMPORTANT: Keep this TODO until the central logger file exists.
  // TODO(logger): add the web logger file path here and nowhere else, for
  // example `src/shared/lib/logger/index.ts`.
  loggerConsoleFiles: [],
  extraRules: {
    '@typescript-eslint/no-floating-promises': 'off',
  },
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
    {
      files: ['src/shared/ui/**/*.tsx'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
});
