import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

const sharedIgnores = [
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/.turbo/**',
  '**/.next/**',
  '**/storybook-static/**',
  '**/*.d.ts',
  '**/*.log',
  '**/logs/**',
  '**/.env',
  '**/.env.*',
];

const sharedRules = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-console': 'error',
  'no-debugger': 'warn',
  'no-duplicate-imports': 'error',
  'no-var': 'error',
  'object-shorthand': ['error', 'always'],
  'prefer-const': ['error', { destructuring: 'all' }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
  ],
};

// IMPORTANT: Keep this TODO in place.
// TODO(logger): `console.*` must stay forbidden everywhere except the single
// central logger implementation file. When that logger is added, update the
// workspace `loggerConsoleFiles` list instead of weakening `no-console`.

function resolveGlobals(runtime, customGlobals = {}) {
  if (runtime === 'browser') {
    return {
      ...globals.browser,
      ...customGlobals,
    };
  }

  if (runtime === 'fullstack') {
    return {
      ...globals.browser,
      ...globals.node,
      ...customGlobals,
    };
  }

  if (runtime === 'node') {
    return {
      ...globals.node,
      ...customGlobals,
    };
  }
  // library
  return customGlobals;
}

export function createWorkspaceConfig({
  tsconfigRootDir,
  runtime = 'library',
  extraIgnores = [],
  extraRules = {},
  extraGlobals = {},
  loggerConsoleFiles = [],
  overrides = [],
} = {}) {
  return defineConfig(
    {
      ignores: [...sharedIgnores, ...extraIgnores],
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
      },
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      files: ['**/*.{ts,tsx,mts,cts}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: resolveGlobals(runtime, extraGlobals),
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        ...sharedRules,
        ...extraRules,
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      ...tseslint.configs.disableTypeChecked,
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: resolveGlobals(runtime, extraGlobals),
      },
    },
    ...(loggerConsoleFiles.length > 0
      ? [
          {
            files: loggerConsoleFiles,
            rules: {
              'no-console': 'off',
            },
          },
        ]
      : []),
    ...overrides,
  );
}

export default createWorkspaceConfig({
  extraIgnores: ['**/*'],
});
