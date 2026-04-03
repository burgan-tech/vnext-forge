import fs from 'node:fs/promises'
import path from 'node:path'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import type { Dirent } from 'node:fs'

export interface SearchResult {
  path: string
  line: number
  text: string
}

export interface DirectoryEntry {
  name: string
  path: string
  type: 'file' | 'directory'
}

function toDirectoryEntry(dirPath: string, entry: Dirent): DirectoryEntry {
  return {
    name: entry.name,
    path: path.join(dirPath, entry.name),
    type: entry.isDirectory() ? 'directory' : 'file',
  }
}

export class FileService {
  async readFile(filePath: string, traceId?: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      throw this.toFileError(error, 'FileService.readFile', traceId, { filePath })
    }
  }

  async writeFile(filePath: string, content: string, traceId?: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      throw this.toFileError(error, 'FileService.writeFile', traceId, { filePath })
    }
  }

  async deleteFile(filePath: string, traceId?: string): Promise<void> {
    try {
      await fs.rm(filePath, { recursive: true })
    } catch (error) {
      throw this.toFileError(error, 'FileService.deleteFile', traceId, { filePath })
    }
  }

  async createDirectory(dirPath: string, traceId?: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw this.toFileError(error, 'FileService.createDirectory', traceId, { dirPath })
    }
  }

  async renameFile(oldPath: string, newPath: string, traceId?: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath)
    } catch (error) {
      throw this.toFileError(error, 'FileService.renameFile', traceId, { oldPath, newPath })
    }
  }

  async searchFiles(projectPath: string, query: string, traceId?: string): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    try {
      await this.searchDir(projectPath, query.toLowerCase(), results, traceId)
      return results.slice(0, 100)
    } catch (error) {
      if (error instanceof VnextForgeError) {
        throw error
      }

      throw this.toFileError(error, 'FileService.searchFiles', traceId, { projectPath, query })
    }
  }

  async browseDirs(dirPath: string, traceId?: string): Promise<DirectoryEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      return entries
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => toDirectoryEntry(dirPath, entry))
        .sort((left, right) => {
          if (left.type !== right.type) {
            return left.type === 'directory' ? -1 : 1
          }

          return left.name.localeCompare(right.name)
        })
    } catch (error) {
      throw this.toFileError(error, 'FileService.browseDirs', traceId, { dirPath })
    }
  }

  private async searchDir(
    dirPath: string,
    query: string,
    results: SearchResult[],
    traceId?: string,
  ): Promise<void> {
    let entries: Dirent[]

    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true })
    } catch (error) {
      throw this.toFileError(error, 'FileService.searchDir', traceId, { dirPath, query })
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue
      }

      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        await this.searchDir(fullPath, query, results, traceId)
      } else if (/\.(json|csx|ts|js|md)$/.test(entry.name)) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')

          for (let index = 0; index < lines.length; index += 1) {
            if (lines[index].toLowerCase().includes(query)) {
              results.push({
                path: fullPath,
                line: index + 1,
                text: lines[index].trim(),
              })
              if (results.length >= 100) {
                return
              }
            }
          }
        } catch {
          // Skip unreadable or binary files.
        }
      }

      if (results.length >= 100) {
        return
      }
    }
  }

  private toFileError(
    error: unknown,
    source: string,
    traceId?: string,
    details?: Record<string, unknown>,
  ): VnextForgeError {
    if (error instanceof VnextForgeError) {
      return error
    }

    const code = (error as NodeJS.ErrnoException | undefined)?.code

    if (code === 'ENOENT') {
      return new VnextForgeError(
        ERROR_CODES.FILE_NOT_FOUND,
        'Requested file or directory was not found',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }

    if (code === 'EACCES' || code === 'EPERM') {
      return new VnextForgeError(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        'Insufficient permissions for file system operation',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }

    const fallbackCode =
      source === 'FileService.deleteFile'
        ? ERROR_CODES.FILE_DELETE_ERROR
        : source === 'FileService.writeFile' ||
            source === 'FileService.createDirectory' ||
            source === 'FileService.renameFile'
          ? ERROR_CODES.FILE_WRITE_ERROR
          : ERROR_CODES.FILE_READ_ERROR

    return new VnextForgeError(
      fallbackCode,
      error instanceof Error ? error.message : 'File system operation failed',
      { source, layer: 'infrastructure', details },
      traceId,
    )
  }
}
