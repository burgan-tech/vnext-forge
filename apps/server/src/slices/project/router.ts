import { Hono } from 'hono'
import { projectController } from './controller.js'

export const projectRouter = new Hono()

projectRouter.get('/', (c) => projectController.list(c))
projectRouter.get('/:id', (c) => projectController.getById(c))
projectRouter.post('/', (c) => projectController.create(c))
projectRouter.post('/import', (c) => projectController.importProject(c))
projectRouter.get('/:id/tree', (c) => projectController.getTree(c))
projectRouter.get('/:id/config', (c) => projectController.getConfig(c))
projectRouter.post('/:id/export', (c) => projectController.exportProject(c))
projectRouter.delete('/:id', (c) => projectController.remove(c))
