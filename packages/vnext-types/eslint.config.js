import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'library',
  // IMPORTANT: Keep this TODO until the package-level central logger exists.
  // TODO(logger): add the package logger file path here only if this package
  // intentionally owns a logger implementation.
  loggerConsoleFiles: [],
  extraIgnores: ['dist/**', 'tsconfig.tsbuildinfo'],
});
