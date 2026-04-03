import type { Context } from 'hono'
import { baseController, type BaseController } from '@controllers/base/index.js'
import { parseRequest } from '@lib/request.js'
import { ProjectService } from '@services/project.service.js'
import {
  projectByIdRequestSchema,
  projectCreateRequestSchema,
  projectExportRequestSchema,
  projectImportRequestSchema,
} from './schema.js'

const projectService = new ProjectService()

export interface ProjectController extends BaseController {
  list(c: Context): Promise<Response>
  getById(c: Context): Promise<Response>
  create(c: Context): Promise<Response>
  importProject(c: Context): Promise<Response>
  getTree(c: Context): Promise<Response>
  getConfig(c: Context): Promise<Response>
  exportProject(c: Context): Promise<Response>
  remove(c: Context): Promise<Response>
}

export const projectController: ProjectController = {
  ...baseController,
  async list(c) {
    const projects = await projectService.listProjects(c.get('traceId'))
    return baseController.ok(c, projects)
  },
  async getById(c) {
    const { params } = await parseRequest(
      c,
      projectByIdRequestSchema,
      'projectController.getById',
    )
    const project = await projectService.getProject(params.id, c.get('traceId'))
    return baseController.ok(c, project)
  },
  async create(c) {
    const { json } = await parseRequest(c, projectCreateRequestSchema, 'projectController.create')
    const project = await projectService.createProject(
      json.domain,
      json.description,
      json.targetPath,
      c.get('traceId'),
    )

    return baseController.created(c, project)
  },
  async importProject(c) {
    const { json } = await parseRequest(
      c,
      projectImportRequestSchema,
      'projectController.importProject',
    )

    const project = await projectService.importProject(json.path, c.get('traceId'))
    return baseController.ok(c, project)
  },
  async getTree(c) {
    const { params } = await parseRequest(
      c,
      projectByIdRequestSchema,
      'projectController.getTree',
    )
    const tree = await projectService.getFileTree(params.id, c.get('traceId'))
    return baseController.ok(c, tree)
  },
  async getConfig(c) {
    const { params } = await parseRequest(
      c,
      projectByIdRequestSchema,
      'projectController.getConfig',
    )
    const config = await projectService.getConfig(params.id, c.get('traceId'))
    return baseController.ok(c, config)
  },
  async exportProject(c) {
    const { params, json } = await parseRequest(
      c,
      projectExportRequestSchema,
      'projectController.exportProject',
    )

    const result = await projectService.exportProject(
      params.id,
      json.targetPath,
      c.get('traceId'),
    )

    return baseController.ok(c, result)
  },
  async remove(c) {
    const { params } = await parseRequest(c, projectByIdRequestSchema, 'projectController.remove')
    await projectService.removeProject(params.id, c.get('traceId'))
    return baseController.empty(c)
  },
}
