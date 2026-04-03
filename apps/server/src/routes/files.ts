import { Hono } from 'hono'
import { fileController } from '@controllers/file/index.js'

export const fileRoutes = new Hono()

fileRoutes.get('/', (c) => fileController.read(c))
fileRoutes.put('/', (c) => fileController.write(c))
fileRoutes.delete('/', (c) => fileController.remove(c))
fileRoutes.post('/mkdir', (c) => fileController.createDirectory(c))
fileRoutes.post('/rename', (c) => fileController.rename(c))
fileRoutes.get('/browse', (c) => fileController.browse(c))
fileRoutes.get('/search', (c) => fileController.search(c))
