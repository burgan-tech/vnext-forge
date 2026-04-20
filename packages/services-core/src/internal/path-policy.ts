import path from 'node:path'

import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'

import type { FileSystemAdapter, LoggerAdapter } from '../adapters/index.js'

/**
 * Filesystem jail. Ensures that every path the workspace / project services
 * operate on lives under one of a configured set of "approved roots", with
 * symlink-aware containment.
 *
 * The jail solves three concrete attack vectors:
 *   1. Path traversal via `..` segments smuggled in user-supplied paths.
 *   2. Absolute-path escapes (`/etc/passwd`, `C:\\Windows\\System32`).
 *   3. Symlink farms inside an allowed root that link out to the rest of
 *      the host filesystem.
 *
 * The policy is intentionally enforced inside services-core (one level above
 * the FileSystemAdapter) so every host shell that wires the same approved
 * roots gets the same protection without re-implementing the rules.
 */

export interface PathPolicyDeps {
  /**
   * Allow-listed root directories. Every path passed to `assertWithin*`
   * must canonicalize to a descendant of one of these roots. Pass an empty
   * array to enter "open" mode, in which the policy logs a warning at
   * construction time but never rejects (used by the in-process VS Code
   * extension shell where the user already trusts the workspace).
   */
  approvedRoots: readonly string[]
  fs: FileSystemAdapter
  logger: LoggerAdapter
  /**
   * When `false` (the default), a target whose `realpath` differs from
   * its requested path AND lands outside the approved roots is rejected
   * even if the originally-requested path was inside them. When `true`,
   * symlinks may resolve anywhere; only the requested path itself must
   * be inside an approved root. Set this to `true` only for trusted
   * single-developer environments.
   */
  allowSymlinkEscape?: boolean
}

export interface PathPolicy {
  /**
   * Validate that `target` is safe to read from. Throws
   * `VnextForgeError(FILE_PERMISSION_DENIED)` on violation.
   */
  assertReadable(target: string, traceId?: string): Promise<void>
  /**
   * Validate that `target` is safe to write to or delete. The parent
   * directory is checked when `target` itself does not yet exist, so
   * `createDirectory` / `writeFile` calls work for new files.
   */
  assertWritable(target: string, traceId?: string): Promise<void>
  /**
   * Browse-only check. Browse may roam outside approved roots when the
   * policy is in "open" mode (no roots configured); when roots ARE
   * configured, browsing is restricted to descendants of an approved
   * root or to the user's home directory which is always implicitly
   * approved for browsing (so the folder picker works).
   */
  assertBrowsable(target: string, traceId?: string): Promise<void>
  /**
   * `true` when no approved roots were configured. Callers MUST treat
   * this as a development-only mode and log a clear warning to the
   * operator at boot.
   */
  readonly isOpen: boolean
}

/** Construct a `PathPolicy`. See `PathPolicyDeps` for tuning knobs. */
export function createPathPolicy(deps: PathPolicyDeps): PathPolicy {
  const { fs, logger } = deps
  const allowSymlinkEscape = deps.allowSymlinkEscape ?? false
  const normalizedRoots = deps.approvedRoots
    .map((root) => normalizeAbsolute(root))
    .filter((root): root is string => root !== null)
  const isOpen = normalizedRoots.length === 0

  if (isOpen) {
    logger.warn(
      {
        source: 'services-core.createPathPolicy',
        approvedRoots: deps.approvedRoots,
      },
      'Path policy started in OPEN mode (no approved roots configured). ' +
        'Every workspace/project operation will be permitted; this is only ' +
        'safe for single-developer local hosts.',
    )
  }

  async function canonicalize(target: string): Promise<string> {
    // We try `realpath` first to follow symlinks. If the target does not
    // exist yet (common for `writeFile` to a new file), fall back to the
    // canonical parent + the leaf name so creation is still gated.
    try {
      return path.normalize(await fs.realpath(target))
    } catch (error) {
      const errno = (error as NodeJS.ErrnoException).code
      if (errno !== 'ENOENT' && errno !== 'ENOTDIR') throw error
      const parent = path.dirname(target)
      // If the parent also does not exist we cannot realpath either, so
      // fall back to a manually-normalized absolute path. This is still
      // safe because the next `assertContains` check rejects any escape.
      let parentReal: string
      try {
        parentReal = path.normalize(await fs.realpath(parent))
      } catch {
        parentReal = normalizeAbsolute(parent) ?? parent
      }
      return path.join(parentReal, path.basename(target))
    }
  }

  function assertContains(canonical: string, traceId: string | undefined, mode: string): void {
    if (isOpen) return
    const ok = normalizedRoots.some((root) => isWithin(root, canonical))
    if (ok) return
    throw new VnextForgeError(
      ERROR_CODES.FILE_PERMISSION_DENIED,
      `Path ${canonical} is outside the approved workspace roots.`,
      {
        source: 'services-core.PathPolicy',
        layer: 'application',
        details: { mode, canonical, approvedRoots: normalizedRoots },
      },
      traceId,
    )
  }

  async function assert(
    target: string,
    traceId: string | undefined,
    mode: 'read' | 'write' | 'browse',
  ): Promise<void> {
    if (isOpen && mode !== 'browse') return
    const requestedNormalized = normalizeAbsolute(target)
    if (!requestedNormalized) {
      throw new VnextForgeError(
        ERROR_CODES.FILE_INVALID_PATH,
        `Path must be absolute. Got: ${target}`,
        {
          source: 'services-core.PathPolicy',
          layer: 'application',
          details: { target, mode },
        },
        traceId,
      )
    }

    // Browse can always touch the user's home dir even in open mode so the
    // folder picker works; otherwise it must be inside an approved root.
    if (mode === 'browse' && isWithin(fs.resolveHome(), requestedNormalized)) {
      return
    }

    const canonical = await canonicalize(requestedNormalized)

    // Symlink escape policy: when the requested path is inside an
    // approved root but its canonical form is not, the symlink is
    // pointing outside the jail.
    if (
      !allowSymlinkEscape &&
      !isOpen &&
      normalizedRoots.some((root) => isWithin(root, requestedNormalized)) &&
      !normalizedRoots.some((root) => isWithin(root, canonical))
    ) {
      throw new VnextForgeError(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        `Path ${target} resolves through a symlink to ${canonical}, which is outside the approved roots.`,
        {
          source: 'services-core.PathPolicy',
          layer: 'application',
          details: { target, canonical, mode, approvedRoots: normalizedRoots },
        },
        traceId,
      )
    }

    assertContains(canonical, traceId, mode)
  }

  return {
    isOpen,
    async assertReadable(target, traceId) {
      await assert(target, traceId, 'read')
    },
    async assertWritable(target, traceId) {
      await assert(target, traceId, 'write')
    },
    async assertBrowsable(target, traceId) {
      await assert(target, traceId, 'browse')
    },
  }
}

/**
 * Normalize a path to an OS-canonical absolute form. Returns `null` for
 * empty / non-absolute inputs so the caller can produce a structured
 * `FILE_INVALID_PATH` error instead of silently rebasing onto the cwd.
 */
function normalizeAbsolute(target: string): string | null {
  if (!target || target.length === 0) return null
  // `path.isAbsolute` understands both POSIX and Windows shapes when run
  // on the matching platform; fall back to a heuristic for the cross-OS
  // case (e.g. Windows-style path normalized on a POSIX host).
  if (!path.isAbsolute(target) && !/^[a-zA-Z]:[\\/]/.test(target)) {
    return null
  }
  return path.normalize(target)
}

/**
 * `true` when `child` is `parent` itself or a descendant of it. Comparison
 * is case-insensitive on Windows and case-sensitive elsewhere, matching
 * the host filesystem semantics.
 */
function isWithin(parent: string, child: string): boolean {
  const normalize = process.platform === 'win32' ? (s: string) => s.toLowerCase() : (s: string) => s
  const p = normalize(path.resolve(parent))
  const c = normalize(path.resolve(child))
  if (c === p) return true
  const sep = process.platform === 'win32' ? '\\' : '/'
  return c.startsWith(p.endsWith(sep) ? p : `${p}${sep}`)
}
