import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'node',
  loggerConsoleFiles: ['src/shared/lib/logger.ts'],
  overrides: [
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,
    promisePlugin.configs['flat/recommended'],
    {
      files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
      plugins: {
        'unused-imports': unusedImportsPlugin,
      },
      settings: {
        'import/resolver': {
          typescript: {
            project: './tsconfig.json',
          },
          node: true,
        },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': [
          'warn',
          {
            args: 'after-used',
            argsIgnorePattern: '^_',
            ignoreRestSiblings: true,
            vars: 'all',
            varsIgnorePattern: '^_',
          },
        ],
      },
    },
  ],
});
