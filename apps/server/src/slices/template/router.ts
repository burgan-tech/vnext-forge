import { Hono } from 'hono'
import { templateController } from './controller.js'

export const templateRouter = new Hono()

templateRouter.get('/', (c) => templateController.list(c))
