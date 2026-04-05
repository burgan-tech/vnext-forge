import { Hono } from 'hono'
import { runtimeProxyController } from './controller.js'

export const runtimeProxyRouter = new Hono()
  .all('/*', (c) => runtimeProxyController.proxy(c))
