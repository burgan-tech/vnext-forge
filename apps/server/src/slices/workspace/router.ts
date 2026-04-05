import { Hono } from 'hono'
import { workspaceController } from './controller.js'

export const workspaceRouter = new Hono()
  .get('/', (c) => workspaceController.read(c))
  .put('/', (c) => workspaceController.write(c))
  .delete('/', (c) => workspaceController.remove(c))
  .post('/mkdir', (c) => workspaceController.createDirectory(c))
  .post('/rename', (c) => workspaceController.rename(c))
  .get('/browse', (c) => workspaceController.browse(c))
  .get('/search', (c) => workspaceController.search(c))
