import type { Context } from 'hono'
import { getRequestLogger } from '@shared/lib/logger.js'
import { parseRequest } from '@shared/lib/request.js'
import { ok, created, empty } from '@shared/lib/response.js'
import { ProjectService } from './service.js'
import {
  projectByIdRequestSchema,
  projectCreateRequestSchema,
  projectExportRequestSchema,
  projectImportRequestSchema,
} from './schema.js'

const projectService = new ProjectService()

export const projectController = {
  async list(c: Context): Promise<Response> {
    const projects = await projectService.listProjects(c.get('traceId'))
    return ok(c, projects)
  },

  async getById(c: Context): Promise<Response> {
    const { params } = await parseRequest(c, projectByIdRequestSchema, 'projectController.getById')
    const project = await projectService.getProject(params.id, c.get('traceId'))
    return ok(c, project)
  },

  async create(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'projectController.create')
    const { json } = await parseRequest(c, projectCreateRequestSchema, 'projectController.create')
    logger.info({ domain: json.domain, targetPath: json.targetPath }, 'creating project')
    const project = await projectService.createProject(
      json.domain,
      json.description,
      json.targetPath,
      c.get('traceId'),
    )
    return created(c, project)
  },

  async importProject(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'projectController.importProject')
    const { json } = await parseRequest(
      c,
      projectImportRequestSchema,
      'projectController.importProject',
    )
    logger.info({ sourcePath: json.path }, 'importing project')
    const project = await projectService.importProject(json.path, c.get('traceId'))
    return ok(c, project)
  },

  async getTree(c: Context): Promise<Response> {
    const { params } = await parseRequest(c, projectByIdRequestSchema, 'projectController.getTree')
    const tree = await projectService.getFileTree(params.id, c.get('traceId'))
    return ok(c, tree)
  },

  async getConfig(c: Context): Promise<Response> {
    const { params } = await parseRequest(
      c,
      projectByIdRequestSchema,
      'projectController.getConfig',
    )
    const config = await projectService.getConfig(params.id, c.get('traceId'))
    return ok(c, config)
  },

  async exportProject(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'projectController.exportProject')
    const { params, json } = await parseRequest(
      c,
      projectExportRequestSchema,
      'projectController.exportProject',
    )
    logger.info({ projectId: params.id, targetPath: json.targetPath }, 'exporting project')
    const result = await projectService.exportProject(params.id, json.targetPath, c.get('traceId'))
    return ok(c, result)
  },

  async remove(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'projectController.remove')
    const { params } = await parseRequest(c, projectByIdRequestSchema, 'projectController.remove')
    logger.info({ projectId: params.id }, 'removing project')
    await projectService.removeProject(params.id, c.get('traceId'))
    return empty(c)
  },
}
