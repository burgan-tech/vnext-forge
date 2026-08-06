import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Ensure `entry` is present in the workspace `.gitignore`.
 *
 * The runtime clone lives inside the workspace so the developer can see it and
 * drop to `make` by hand — which means it must never be committed. Idempotent:
 * an entry that is already there (in any position) is left alone.
 */
export async function ensureGitignoreEntry(
  workspacePath: string,
  entry: string,
  /** Comment written above the entry the first time it is added. */
  comment = 'vNext Forge managed local runtime',
): Promise<void> {
  const gitignorePath = path.join(workspacePath, '.gitignore');

  let existing = '';
  try {
    existing = await fs.readFile(gitignorePath, 'utf-8');
  } catch {
    // No .gitignore yet — we create one below.
  }

  const alreadyPresent = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === entry);
  if (alreadyPresent) return;

  const needsNewline = existing.length > 0 && !existing.endsWith('\n');
  const addition = `${needsNewline ? '\n' : ''}\n# ${comment}\n${entry}\n`;
  await fs.writeFile(gitignorePath, existing + addition, 'utf-8');
}
