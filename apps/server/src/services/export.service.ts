import fs from 'node:fs/promises'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'

export class ExportService {
  async exportAsVnext(projectPath: string, targetPath: string, traceId?: string): Promise<void> {
    try {
      await fs.cp(projectPath, targetPath, { recursive: true })
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_SAVE_ERROR,
        error instanceof Error ? error.message : 'Project export failed',
        {
          source: 'ExportService.exportAsVnext',
          layer: 'infrastructure',
          details: { projectPath, targetPath },
        },
        traceId,
      )
    }
  }
}
