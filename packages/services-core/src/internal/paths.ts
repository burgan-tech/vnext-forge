/**
 * Pure path helpers — services-core is platform-agnostic and MUST NOT touch
 * Node `path` directly inside business code. Callers that need `path.join`
 * should accept it via the FileSystemAdapter or use these helpers, which only
 * operate on POSIX-style strings.
 */

export function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

export function joinPosix(...parts: string[]): string {
  return joinWithSeparator('/', ...parts)
}

/**
 * Generic, OS-agnostic path join that takes the separator explicitly.
 * Internal/iç state (project IDs, link files, registry fixtures) MUST keep
 * using `joinPosix` so the persisted strings stay platform-portable. This
 * helper exists only for paths that are displayed to the user or fed back
 * into the OS filesystem unchanged (e.g. the workspace folder picker), where
 * Windows users expect native `\\` separators.
 */
export function joinWithSeparator(separator: '/' | '\\', ...parts: string[]): string {
  const cleaned = parts
    .map((part, idx) => {
      if (idx === 0) return part.replace(/[/\\]+$/, '')
      return part.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '')
    })
    .filter((p) => p.length > 0)
  return cleaned.join(separator)
}

export function relativePosix(rootAbs: string, childAbs: string): string {
  const root = toPosix(rootAbs).replace(/\/+$/, '')
  const child = toPosix(childAbs)
  if (child === root) return ''
  if (child.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
    return child.slice(root.length + 1)
  }
  return child
}

export function basename(filePath: string): string {
  const parts = toPosix(filePath).split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

export function dirname(filePath: string): string {
  const parts = toPosix(filePath).split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

export function extname(filePath: string): string {
  const base = basename(filePath)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot)
}

export function isAbsolutePosix(filePath: string): boolean {
  if (!filePath) return false
  if (filePath.startsWith('/')) return true
  return /^[A-Za-z]:[\\/]/.test(filePath)
}
