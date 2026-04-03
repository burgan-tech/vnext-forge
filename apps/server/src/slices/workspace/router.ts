import { Hono } from 'hono'
import { workspaceController } from './controller.js'

export const workspaceRouter = new Hono()

workspaceRouter.get('/', (c) => workspaceController.read(c))
workspaceRouter.put('/', (c) => workspaceController.write(c))
workspaceRouter.delete('/', (c) => workspaceController.remove(c))
workspaceRouter.post('/mkdir', (c) => workspaceController.createDirectory(c))
workspaceRouter.post('/rename', (c) => workspaceController.rename(c))
workspaceRouter.get('/browse', (c) => workspaceController.browse(c))
workspaceRouter.get('/search', (c) => workspaceController.search(c))
