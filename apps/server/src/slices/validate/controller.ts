import type { Context } from 'hono'
import { getRequestLogger } from '@shared/lib/logger.js'
import { parseRequest } from '@shared/lib/request.js'
import { ok } from '@shared/lib/response-helpers.js'
import { validateService } from './service.js'
import {
  validateRequestSchema,
  validateComponentRequestSchema,
  schemaByTypeRequestSchema,
} from './schema.js'

export const validateController = {
  async validate(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'validateController.validate')
    const { json } = await parseRequest(c, validateRequestSchema, 'validateController.validate')
    logger.info({ payloadType: typeof json }, 'validating workflow payload')
    const result = validateService.validate(json)
    return ok(c, result)
  },

  async validateComponent(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'validateController.validateComponent')
    const { json } = await parseRequest(
      c,
      validateComponentRequestSchema,
      'validateController.validateComponent',
    )
    logger.info({ type: json.type }, 'validating component against schema')
    const result = validateService.validateComponent(json.content, json.type)
    return ok(c, result)
  },

  async getSchemas(c: Context): Promise<Response> {
    const schemas = validateService.getAllSchemas()
    return ok(c, { schemas, types: validateService.getAvailableTypes() })
  },

  async getSchemaByType(c: Context): Promise<Response> {
    const { params } = await parseRequest(
      c,
      schemaByTypeRequestSchema,
      'validateController.getSchemaByType',
    )
    const schema = validateService.getSchema(params.type)
    if (!schema) {
      return ok(c, { schema: null, available: validateService.getAvailableTypes() })
    }
    return ok(c, { schema })
  },
}
