import type { Context } from 'hono'
import { workflowTemplateCatalog } from '@vnext-studio/workflow-system'
import { baseController, type BaseController } from '@controllers/base/index.js'
import { parseRequest } from '@lib/request.js'
import { templateListRequestSchema } from './schema.js'

export interface TemplateController extends BaseController {
  list(c: Context): Promise<Response>
}

export const templateController: TemplateController = {
  ...baseController,
  async list(c) {
    await parseRequest(c, templateListRequestSchema, 'templateController.list')
    return baseController.ok(c, workflowTemplateCatalog)
  },
}
