import type { Context } from 'hono';
import { workflowTemplateCatalog } from '@vnext-studio/workflow-system';
import { getRequestLogger } from '@shared/lib/logger.js';
import { parseRequest } from '@shared/lib/request.js';
import { ok } from '@shared/lib/response-helpers.js';
import { templateListRequestSchema } from './schema.js';

export const templateController = {
  async list(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'templateController.list');
    await parseRequest(c, templateListRequestSchema, 'templateController.list');
    logger.info({ count: workflowTemplateCatalog.length }, 'listing workflow templates');
    return ok(c, workflowTemplateCatalog);
  },
};
