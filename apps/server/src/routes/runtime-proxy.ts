import { Hono } from 'hono'
import { runtimeProxyController } from '@controllers/runtime-proxy/index.js'

export const runtimeProxyRoutes = new Hono()

runtimeProxyRoutes.all('/*', (c) => runtimeProxyController.proxy(c))
