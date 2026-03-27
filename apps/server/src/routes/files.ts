import { Hono } from 'hono'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { FileService } from '../services/file.service.js'

export const fileRoutes = new Hono()
const fileService = new FileService()

// Read file
fileRoutes.get('/', async (c) => {
  try {
    const filePath = c.req.query('path')
    if (!filePath) return c.json({ error: 'path required' }, 400)
    const content = await fileService.readFile(filePath)
    return c.json({ path: filePath, content })
  } catch (error) {
    return c.json({ error: String(error) }, 404)
  }
})

// Write file
fileRoutes.put('/', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.path || body.content === undefined) return c.json({ error: 'path and content required' }, 400)
    await fileService.writeFile(body.path, body.content)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Delete file
fileRoutes.delete('/', async (c) => {
  try {
    const filePath = c.req.query('path')
    if (!filePath) return c.json({ error: 'path required' }, 400)
    await fileService.deleteFile(filePath)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Create directory
fileRoutes.post('/mkdir', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.path) return c.json({ error: 'path required' }, 400)
    await fileService.createDirectory(body.path)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Rename file
fileRoutes.post('/rename', async (c) => {
  try {
    const body = await c.req.json()
    if (!body.oldPath || !body.newPath) return c.json({ error: 'oldPath and newPath required' }, 400)
    await fileService.renameFile(body.oldPath, body.newPath)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Browse directories (for folder picker)
fileRoutes.get('/browse', async (c) => {
  try {
    const dirPath = c.req.query('path') || homedir()
    const entries = await readdir(dirPath, { withFileTypes: true })
    const folders = []
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const fullPath = join(dirPath, entry.name)
        let hasVnextConfig = false
        try {
          await stat(join(fullPath, 'vnext.config.json'))
          hasVnextConfig = true
        } catch {}
        folders.push({
          name: entry.name,
          path: fullPath,
          hasVnextConfig,
        })
      }
    }
    folders.sort((a, b) => a.name.localeCompare(b.name))
    return c.json({ path: dirPath, folders })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Search files
fileRoutes.get('/search', async (c) => {
  try {
    const query = c.req.query('q')
    const projectPath = c.req.query('project')
    if (!query || !projectPath) return c.json({ error: 'q and project required' }, 400)
    const results = await fileService.searchFiles(projectPath, query)
    return c.json(results)
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})
