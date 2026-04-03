import { Hono } from 'hono'
import { templateController } from '@controllers/template/index.js'

export const templateRoutes = new Hono()

templateRoutes.get('/', (c) => templateController.list(c))
