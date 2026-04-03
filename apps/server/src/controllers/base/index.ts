import type { Context } from 'hono'
import type { ResponseMeta } from '@vnext-studio/app-contracts'
import { success } from '@vnext-studio/app-contracts'

export interface BaseController {
  ok<T>(c: Context, data: T, meta?: ResponseMeta): Response
  created<T>(c: Context, data: T, meta?: ResponseMeta): Response
  empty(c: Context): Response
}

export const baseController: BaseController = {
  ok<T>(c: Context, data: T, meta?: ResponseMeta): Response {
    return c.json(success(data, meta))
  },
  created<T>(c: Context, data: T, meta?: ResponseMeta): Response {
    return c.json(success(data, meta), 201)
  },
  empty(c: Context): Response {
    return c.json(success(null))
  },
}
