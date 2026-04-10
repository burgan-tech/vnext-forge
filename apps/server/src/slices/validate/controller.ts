import type { Context } from 'hono';
import { getRequestLogger } from '@shared/lib/logger.js';
import { parseRequest } from '@shared/lib/request.js';
import { ok } from '@shared/lib/response-helpers.js';
import { validateService } from './service.js';
import { validateRequestSchema } from './schema.js';

export const validateController = {
  async validate(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'validateController.validate');
    const { json } = await parseRequest(c, validateRequestSchema, 'validateController.validate');
    logger.info({ payloadType: typeof json }, 'validating workflow payload');
    const result = validateService.validate(json);
    return ok(c, result);
  },
};
