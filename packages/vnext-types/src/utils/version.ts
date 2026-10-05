/**
 * Lenient `major.minor.patch` parse. Ignores a leading `v`, a pre-release or
 * build suffix (`0.0.55-local.1`, `1.0.0+abc`) and any fourth component
 * (`0.0.99.0` — .NET assembly versions).
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const core = version.trim().replace(/^v/i, '').split(/[-+]/)[0];
  const parts = core.split('.').map(Number);
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

/** First runtime release carrying the 0.0.99 read surfaces (labels, targets, correlation tree, metrics, executionType). */
export const RUNTIME_0_0_99 = '0.0.99';

/**
 * True when a reported runtime version is at least `minimum`. Returns
 * `undefined` when the version is unknown or unparseable, so callers can
 * pick a "try the new surface, fall back on 404" path instead of guessing.
 */
export function runtimeAtLeast(version: string | null | undefined, minimum: string): boolean | undefined {
  if (!version || !/\d+\.\d+/.test(version)) return undefined;
  return compareVersions(version, minimum) >= 0;
}
