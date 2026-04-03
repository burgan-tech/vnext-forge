import { Hono } from 'hono'
import { runtimeProxyController } from './controller.js'

export const runtimeProxyRouter = new Hono()

runtimeProxyRouter.all('/*', (c) => runtimeProxyController.proxy(c))
