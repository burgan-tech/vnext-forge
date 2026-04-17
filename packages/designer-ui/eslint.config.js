import { createWorkspaceConfig } from '../../eslint.config.mjs';

export default createWorkspaceConfig({
  tsconfigRootDir: import.meta.dirname,
  runtime: 'browser',
  loggerConsoleFiles: ['src/lib/logger/createLogger.ts'],
  extraIgnores: ['dist/**', 'tsconfig.tsbuildinfo'],
});
