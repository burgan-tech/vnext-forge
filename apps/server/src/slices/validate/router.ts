import { Hono } from 'hono'
import { validateController } from './controller.js'

export const validateRouter = new Hono()

validateRouter.post('/', (c) => validateController.validate(c))
