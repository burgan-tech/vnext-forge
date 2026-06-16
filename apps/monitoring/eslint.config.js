import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'browser',
  overrides: [
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
