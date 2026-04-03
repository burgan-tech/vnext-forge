import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'library',
  loggerConsoleFiles: [],
  extraIgnores: ['dist/**', 'tsconfig.tsbuildinfo'],
});
