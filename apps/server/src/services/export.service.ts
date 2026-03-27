import fs from 'node:fs/promises'
import path from 'node:path'

export class ExportService {
  async exportAsVnext(projectPath: string, targetPath: string): Promise<void> {
    await fs.cp(projectPath, targetPath, { recursive: true })
  }
}
