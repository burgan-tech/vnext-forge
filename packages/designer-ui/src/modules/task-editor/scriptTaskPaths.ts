/** POSIX path helpers for task JSON ↔ .csx resolution (browser-safe). */

export function normalizePosixPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

export function posixDirname(p: string): string {
  const n = normalizePosixPath(p);
  const i = n.lastIndexOf('/');
  if (i <= 0) return '';
  return n.slice(0, i);
}

export function posixJoin(...parts: string[]): string {
  return normalizePosixPath(
    parts
      .filter((x) => x.length > 0)
      .join('/')
      .replace(/\/+/g, '/'),
  );
}

/**
 * Relative path from `fromDir` (directory) to `toFile` (file path), using `..` segments.
 */
export function posixRelative(fromDir: string, toFile: string): string {
  const fromParts = normalizePosixPath(fromDir).replace(/\/$/, '').split('/').filter(Boolean);
  const toParts = normalizePosixPath(toFile).split('/').filter(Boolean);
  let i = 0;
  const max = Math.min(fromParts.length, toParts.length);
  while (i < max && fromParts[i] === toParts[i]) i++;
  const ups = fromParts.length - i;
  const rest = toParts.slice(i);
  const segments = [...Array(ups).fill('..'), ...rest];
  const r = segments.join('/');
  return r || '.';
}

/** `./src/x.csx` or `../shared/x.csx` style for task `config.location`. */
export function toTaskRelativeScriptLocation(taskJsonPath: string, scriptAbsolutePath: string): string {
  const taskDir = posixDirname(normalizePosixPath(taskJsonPath));
  const abs = normalizePosixPath(scriptAbsolutePath);
  const rel = posixRelative(taskDir, abs);
  if (rel.startsWith('.')) return rel;
  return rel === '' ? './' : `./${rel}`;
}

function stripLeadingDotSlash(loc: string): string {
  return loc.replace(/^\.\//, '');
}

/** Absolute path to .csx from task JSON path and stored `config.location`. */
export function resolveTaskScriptAbsolutePath(taskJsonPath: string, location: string): string {
  const taskDir = posixDirname(normalizePosixPath(taskJsonPath));
  const rel = stripLeadingDotSlash(location.trim());
  return posixJoin(taskDir, rel);
}

/** Display path relative to project root (no leading `./` required). */
export function toProjectRelativePath(projectRoot: string, absolutePath: string): string {
  const root = normalizePosixPath(projectRoot).replace(/\/$/, '');
  const abs = normalizePosixPath(absolutePath);
  return posixRelative(root, abs);
}
