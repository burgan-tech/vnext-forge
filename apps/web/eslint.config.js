import importFsdPlugin from 'eslint-plugin-import-fsd';
import reactDom from 'eslint-plugin-react-dom';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactX from 'eslint-plugin-react-x';

import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'browser',
  loggerConsoleFiles: ['src/shared/lib/logger/createLogger.ts'],
  extraRules: {
    '@typescript-eslint/no-floating-promises': 'off',
  },
  overrides: [
    {
      files: ['src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
      ...importFsdPlugin.configs.recommended,
      settings: {
        fsd: {
          rootDir: `${import.meta.dirname}/src`,
          aliases: {
            '@app/*': './src/app/*',
            '@pages/*': './src/pages/*',
            '@widgets/*': './src/widgets/*',
            '@features/*': './src/features/*',
            '@entities/*': './src/entities/*',
            '@shared/*': './src/shared/*',
          },
        },
      },
    },
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
