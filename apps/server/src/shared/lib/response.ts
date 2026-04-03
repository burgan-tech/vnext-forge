import type { Context } from 'hono'
import { success } from '@vnext-studio/app-contracts'
import type { ResponseMeta } from '@vnext-studio/app-contracts'

export const ok = <T>(c: Context, data: T, meta?: ResponseMeta): Response =>
  c.json(success(data, meta))

export const created = <T>(c: Context, data: T, meta?: ResponseMeta): Response =>
  c.json(success(data, meta), 201)

export const empty = (c: Context): Response => c.json(success(null))
