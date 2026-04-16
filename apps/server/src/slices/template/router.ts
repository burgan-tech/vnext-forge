import { Hono } from 'hono'
import { templateController } from './controller.js'

export const templateRouter = new Hono()
  .post('/seed', (c) => templateController.seedTemplate(c))
