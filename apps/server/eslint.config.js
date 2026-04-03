import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'node',
  // IMPORTANT: Keep this TODO until the central logger file exists.
  // TODO(logger): add the server logger file path here and nowhere else.
  loggerConsoleFiles: [],
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
