import { Hono } from 'hono'
import { ProjectService } from '../services/project.service.js'

export const projectRoutes = new Hono()
const projectService = new ProjectService()

// List all projects
projectRoutes.get('/', async (c) => {
  try {
    const projects = await projectService.listProjects()
    return c.json(projects)
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Get project details
projectRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const project = await projectService.getProject(id)
    return c.json(project)
  } catch (error) {
    return c.json({ error: String(error) }, 404)
  }
})

// Create new project
projectRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const project = await projectService.createProject(body.domain, body.description, body.targetPath)
    return c.json(project, 201)
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Import existing project
projectRoutes.post('/import', async (c) => {
  try {
    const body = await c.req.json()
    const project = await projectService.importProject(body.path)
    return c.json(project)
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Get project file tree
projectRoutes.get('/:id/tree', async (c) => {
  try {
    const id = c.req.param('id')
    const tree = await projectService.getFileTree(id)
    return c.json(tree)
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Get project config
projectRoutes.get('/:id/config', async (c) => {
  try {
    const id = c.req.param('id')
    const config = await projectService.getConfig(id)
    return c.json(config)
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Export project
projectRoutes.post('/:id/export', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const result = await projectService.exportProject(id, body.targetPath)
    return c.json(result)
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// Remove project (unlink)
projectRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const result = await projectService.removeProject(id)
    return c.json(result)
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})
