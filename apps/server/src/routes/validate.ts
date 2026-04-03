import { Hono } from 'hono'
import { validateController } from '@controllers/validate/index.js'

export const validateRoutes = new Hono()

validateRoutes.post('/', (c) => validateController.validate(c))
