import { Hono } from 'hono'
import { projectController } from '@controllers/project/index.js'

export const projectRoutes = new Hono()

projectRoutes.get('/', (c) => projectController.list(c))
projectRoutes.get('/:id', (c) => projectController.getById(c))
projectRoutes.post('/', (c) => projectController.create(c))
projectRoutes.post('/import', (c) => projectController.importProject(c))
projectRoutes.get('/:id/tree', (c) => projectController.getTree(c))
projectRoutes.get('/:id/config', (c) => projectController.getConfig(c))
projectRoutes.post('/:id/export', (c) => projectController.exportProject(c))
projectRoutes.delete('/:id', (c) => projectController.remove(c))
