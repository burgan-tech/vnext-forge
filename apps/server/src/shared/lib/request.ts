import type { Context } from 'hono'
import {
  ERROR_CODES,
  VnextForgeError,
  type VnextForgeErrorContext,
} from '@vnext-studio/app-contracts'
import type { ZodTypeAny } from 'zod'

export interface RequestSchemas {
  params?: ZodTypeAny
  query?: ZodTypeAny
  json?: ZodTypeAny
  headers?: ZodTypeAny
}

type InferSchema<TSchema> = TSchema extends ZodTypeAny ? TSchema['_output'] : undefined

export interface ParsedRequest<TSchemas extends RequestSchemas> {
  params: InferSchema<TSchemas['params']>
  query: InferSchema<TSchemas['query']>
  json: InferSchema<TSchemas['json']>
  headers: InferSchema<TSchemas['headers']>
}

function invalidJsonError(
  traceId: string | undefined,
  context: VnextForgeErrorContext,
  cause: unknown,
): VnextForgeError {
  return new VnextForgeError(
    ERROR_CODES.API_BAD_REQUEST,
    'Request body must be valid JSON.',
    {
      ...context,
      details: {
        ...context.details,
        cause: cause instanceof Error ? cause.message : cause,
      },
    },
    traceId,
  )
}

export async function parseRequest<TSchemas extends RequestSchemas>(
  c: Context,
  schemas: TSchemas,
  source: string,
): Promise<ParsedRequest<TSchemas>> {
  const context: VnextForgeErrorContext = {
    source,
    layer: 'transport',
  }

  const parsed: Partial<ParsedRequest<TSchemas>> = {}

  if (schemas.params) {
    parsed.params = schemas.params.parse(c.req.param()) as ParsedRequest<TSchemas>['params']
  }

  if (schemas.query) {
    parsed.query = schemas.query.parse(c.req.query()) as ParsedRequest<TSchemas>['query']
  }

  if (schemas.headers) {
    const headers = Object.fromEntries(c.req.raw.headers.entries())
    parsed.headers = schemas.headers.parse(headers) as ParsedRequest<TSchemas>['headers']
  }

  if (schemas.json) {
    let body: unknown
    try {
      body = await c.req.json()
    } catch (error) {
      throw invalidJsonError(c.get('traceId'), context, error)
    }
    parsed.json = schemas.json.parse(body) as ParsedRequest<TSchemas>['json']
  }

  return parsed as ParsedRequest<TSchemas>
}
