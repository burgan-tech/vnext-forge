import { Hono } from 'hono'
import { templateController } from './controller.js'

export const templateRouter = new Hono()
  .get('/', (c) => templateController.list(c))
