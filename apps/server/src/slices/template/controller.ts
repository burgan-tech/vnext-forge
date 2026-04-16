import type { Context } from 'hono'
import type { VnextWorkspaceConfig } from '@workspace/types.js'
import { getRequestLogger } from '@shared/lib/logger.js'
import { parseRequest } from '@shared/lib/request.js'
import { ok } from '@shared/lib/response-helpers.js'
import { TemplateService } from './service.js'
import { templateSeedRequestSchema } from './schema.js'

const templateService = new TemplateService()

export const templateController = {
  async seedTemplate(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'templateController.seedTemplate')
    const { json } = await parseRequest(
      c,
      templateSeedRequestSchema,
      'templateController.seedTemplate',
    )
    logger.info(
      { targetDir: json.targetDir, domain: json.domain },
      'scaffolding project from vnext-template',
    )

    const result = await templateService.scaffoldFromTemplate(
      json.targetDir,
      json.domain,
      c.get('traceId'),
    )

    if (json.customConfig) {
      logger.info({ domain: json.domain }, 'applying custom vnext.config.json override')
      await templateService.applyCustomConfig(
        json.targetDir,
        json.domain,
        json.customConfig as VnextWorkspaceConfig,
        c.get('traceId'),
      )
    }

    return ok(c, result)
  },
}
