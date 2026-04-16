import { Hono } from 'hono'
import { validateController } from './controller.js'

export const validateRouter = new Hono()
  .post('/', (c) => validateController.validate(c))
  .post('/component', (c) => validateController.validateComponent(c))
  .get('/schemas', (c) => validateController.getSchemas(c))
  .get('/schemas/:type', (c) => validateController.getSchemaByType(c))
