import fs from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import path from 'node:path';

import type {
  DirectoryEntryStat,
  FileStat,
  FileSystemAdapter,
} from '@vnext-forge-studio/services-core';

/**
 * Concrete `FileSystemAdapter` implementation for Node.js shells (apps/server).
 * Wraps `node:fs/promises` and exposes the same surface every services-core
 * service relies on. Errors are re-thrown unchanged so the caller can map them
 * to a `VnextForgeError` with the right `code` / `details`.
 */
export function createNodeFileSystemAdapter(): FileSystemAdapter {
  const isWindows = platform() === 'win32';

  return {
    isWindows,

    async readFile(filePath) {
      return fs.readFile(filePath, 'utf-8');
    },

    async writeFile(filePath, content) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
    },

    async deleteFile(filePath) {
      await fs.unlink(filePath);
    },

    async rename(oldPath, newPath) {
      await fs.rename(oldPath, newPath);
    },

    async mkdir(dirPath, options) {
      await fs.mkdir(dirPath, { recursive: options?.recursive ?? false });
    },

    async rmrf(targetPath) {
      await fs.rm(targetPath, { recursive: true, force: true });
    },

    async copyRecursive(sourcePath, targetPath) {
      await fs.cp(sourcePath, targetPath, { recursive: true });
    },

    async exists(targetPath) {
      try {
        await fs.access(targetPath);
        return true;
      } catch {
        return false;
      }
    },

    async stat(targetPath): Promise<FileStat> {
      const s = await fs.stat(targetPath);
      return {
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        size: s.size,
        mtimeMs: s.mtimeMs,
      };
    },

    async readFileHead(filePath, length) {
      const handle = await fs.open(filePath, 'r');
      try {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, 0);
        return buffer.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
    },

    async realpath(targetPath) {
      return fs.realpath(targetPath);
    },

    async readDir(dirPath): Promise<DirectoryEntryStat[]> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
    },

    resolveHome() {
      return homedir();
    },

    cwd() {
      return process.cwd();
    },
  };
}
