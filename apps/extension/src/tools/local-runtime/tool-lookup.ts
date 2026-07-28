import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ToolLookup } from '@vnext-forge-studio/services-core';

/**
 * Locations to check when a binary is not on PATH.
 *
 * On macOS a VS Code launched from Dock/Finder inherits launchd's PATH
 * (`/usr/bin:/bin:/usr/sbin:/sbin`), which excludes `/usr/local/bin` and
 * `/opt/homebrew/bin` — exactly where docker, orb and docker-compose live.
 * VS Code usually repairs this by resolving the login shell environment, but
 * that can be disabled (`terminal.integrated.inheritEnv: false`) or fail on
 * unusual shell configs, and the symptom is a false "Docker not found".
 *
 * Exported because resolving an absolute path for *our* spawns only solves
 * half of it: the runtime repo's Makefile runs its own `command -v docker`
 * against the child's inherited PATH, so `process-runner` has to widen that
 * PATH with the same list. Removing either half brings the bug back.
 */
export function wellKnownDirs(): string[] {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    return [
      path.join(programFiles, 'Docker', 'Docker', 'resources', 'bin'),
      path.join(programFiles, 'Git', 'cmd'),
      path.join(home, '.docker', 'bin'),
    ];
  }
  return [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    path.join(home, '.docker', 'bin'),
    path.join(home, '.rd', 'bin'),
  ];
}

const WINDOWS_EXTENSIONS = ['.exe', '.cmd', '.bat', ''];

function isExecutableFile(candidate: string): boolean {
  try {
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) return false;
    if (process.platform === 'win32') return true;
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveIn(dir: string, bin: string): string | null {
  const suffixes = process.platform === 'win32' ? WINDOWS_EXTENSIONS : [''];
  for (const suffix of suffixes) {
    const candidate = path.join(dir, `${bin}${suffix}`);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve an executable to an absolute path: PATH first, then the well-known
 * locations above. Returns null when the binary genuinely is not installed.
 *
 * Only successful resolutions are cached. A missing tool must be re-checked
 * on every call: the preflight flow shows a Retry button when a tool is
 * missing or the daemon isn't running, and the whole point of Retry is that
 * the user goes and starts/installs the tool then clicks it again. Caching
 * `null` would make Retry silently do nothing for the rest of the VS Code
 * session. A failed lookup is a handful of cheap `stat`/`access` calls across
 * a short directory list, so redoing it costs nothing.
 */
export function createToolLookup(): ToolLookup {
  const cache = new Map<string, string>();

  return (bin: string): string | null => {
    const cached = cache.get(bin);
    if (cached !== undefined) return cached;

    const pathDirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
    let resolved: string | null = null;
    for (const dir of [...pathDirs, ...wellKnownDirs()]) {
      resolved = resolveIn(dir, bin);
      if (resolved !== null) break;
    }

    if (resolved !== null) cache.set(bin, resolved);
    return resolved;
  };
}
