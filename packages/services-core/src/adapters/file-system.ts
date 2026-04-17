/**
 * Platform-agnostic filesystem adapter.
 *
 * Both shells must provide an implementation:
 * - apps/web-server: Node `fs/promises` based adapter.
 * - apps/extension : VS Code `workspace.fs` (or Node fs) based adapter.
 *
 * Implementations MUST throw the underlying platform error unchanged so the
 * caller (always an adapter-aware service) can map it to a `VnextForgeError`
 * with the right `code`/`source`/`details`. Adapters MUST NOT throw
 * `VnextForgeError` themselves.
 */
export interface FileSystemAdapter {
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<void>
  deleteFile(filePath: string): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>
  rmrf(targetPath: string): Promise<void>
  copyRecursive(sourcePath: string, targetPath: string): Promise<void>

  /** True if the path exists. Never throws on missing path. */
  exists(targetPath: string): Promise<boolean>

  stat(targetPath: string): Promise<FileStat>

  /** Open the head of a file and read up to `length` bytes from offset. */
  readFileHead(filePath: string, length: number): Promise<Buffer>

  readDir(dirPath: string): Promise<DirectoryEntryStat[]>

  /** True only if the running platform exposes Windows-style drive letters. */
  readonly isWindows: boolean
  /** Resolve `~` and absolute paths consistently. */
  resolveHome(): string
  /** Process current working directory; used for system-root browse fallback. */
  cwd(): string
}

export interface FileStat {
  isDirectory: boolean
  isFile: boolean
  size: number
  mtimeMs: number
}

export interface DirectoryEntryStat {
  name: string
  isDirectory: boolean
  isFile: boolean
}
