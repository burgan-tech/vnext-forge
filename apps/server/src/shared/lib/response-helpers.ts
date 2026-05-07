import type { Context } from 'hono';
import { success } from '@vnext-forge-studio/app-contracts';
import type { ResponseMeta } from '@vnext-forge-studio/app-contracts';

export function ok<T>(c: Context, data: T, meta?: ResponseMeta): Response {
  return c.json(success(data, meta));
}

export function created<T>(c: Context, data: T, meta?: ResponseMeta): Response {
  return c.json(success(data, meta), 201);
}

export function empty(c: Context): Response {
  return c.json(success(null));
}
