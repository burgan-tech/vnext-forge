import fs from 'node:fs/promises'
import path from 'node:path'

export class FileService {
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8')
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
  }

  async deleteFile(filePath: string): Promise<void> {
    await fs.rm(filePath, { recursive: true })
  }

  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true })
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await fs.rename(oldPath, newPath)
  }

  async searchFiles(projectPath: string, query: string): Promise<{ path: string; line: number; text: string }[]> {
    const results: { path: string; line: number; text: string }[] = []
    await this.searchDir(projectPath, query.toLowerCase(), results)
    return results.slice(0, 100)
  }

  private async searchDir(dirPath: string, query: string, results: { path: string; line: number; text: string }[]) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        await this.searchDir(fullPath, query, results)
      } else if (/\.(json|csx|ts|js|md)$/.test(entry.name)) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query)) {
              results.push({ path: fullPath, line: i + 1, text: lines[i].trim() })
              if (results.length >= 100) return
            }
          }
        } catch { /* skip binary files */ }
      }
    }
  }
}
