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
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@vnext-forge/server',
            message:
              'Import `@vnext-forge/server` only from `src/shared/api/client.ts` (type-only `AppType` for `hc`) — use `@shared/api` / `HttpTransport` elsewhere.',
          },
          {
            name: '@vnext-forge/services-core',
            message:
              'Import services through designer-ui / ProjectApi or @vnext-forge/app-contracts from apps/web — not services-core directly.',
          },
        ],
        patterns: [
          {
            group: ['**/packages/services-core/**', '**/services-core/src/**'],
            message:
              'Do not deep-import the services-core package from apps/web; use workspace HTTP/RPC boundaries.',
          },
          {
            group: ['@vnext-forge/designer-ui/dist/**'],
            message:
              'Import from @vnext-forge/designer-ui (or documented subpaths like /ui, /editor) — not compiled dist paths.',
          },
        ],
      },
    ],
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
    {
      files: ['src/shared/api/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@vnext-forge/services-core',
                message:
                  'Import services through designer-ui / ProjectApi or @vnext-forge/app-contracts from apps/web — not services-core directly.',
              },
            ],
            patterns: [
              {
                group: ['**/packages/services-core/**', '**/services-core/src/**'],
                message:
                  'Do not deep-import the services-core package from apps/web; use workspace HTTP/RPC boundaries.',
              },
              {
                group: ['@vnext-forge/designer-ui/dist/**'],
                message:
                  'Import from @vnext-forge/designer-ui (or documented subpaths like /ui, /editor) — not compiled dist paths.',
              },
            ],
          },
        ],
      },
    },
  ],
});
