import type { Context } from 'hono'
import { baseController, type BaseController } from '@controllers/base/index.js'
import { parseRequest } from '@lib/request.js'
import { validateRequestSchema } from './schema.js'

export interface ValidateController extends BaseController {
  validate(c: Context): Promise<Response>
}

export const validateController: ValidateController = {
  ...baseController,
  async validate(c) {
    await parseRequest(c, validateRequestSchema, 'validateController.validate')
    return baseController.ok(c, { valid: true, errors: [], warnings: [] })
  },
}
