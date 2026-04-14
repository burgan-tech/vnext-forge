import { Hono } from 'hono'
import { projectController } from './controller.js'

export const projectRouter = new Hono()
  .get('/', (c) => projectController.list(c))
  .get('/:id', (c) => projectController.getById(c))
  .post('/', (c) => projectController.create(c))
  .post('/import', (c) => projectController.importProject(c))
  .get('/:id/tree', (c) => projectController.getTree(c))
  .get('/:id/vnextConfigStatus', (c) => projectController.getConfigStatus(c))
  .get('/:id/vnextComponentLayoutStatus', (c) => projectController.getVnextComponentLayoutStatus(c))
  .post('/:id/vnextComponentLayout', (c) => projectController.seedVnextComponentLayout(c))
  .post('/:id/vnextConfig', (c) => projectController.writeConfig(c))
  .get('/:id/config', (c) => projectController.getConfig(c))
  .post('/:id/export', (c) => projectController.exportProject(c))
  .delete('/:id', (c) => projectController.remove(c))
