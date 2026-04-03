import type { Context } from 'hono'
import { baseController, type BaseController } from '@controllers/base/index.js'
import { parseRequest } from '@lib/request.js'
import { FileService } from '@services/file.service.js'
import {
  fileBrowseRequestSchema,
  fileCreateDirectoryRequestSchema,
  fileReadRequestSchema,
  fileRemoveRequestSchema,
  fileRenameRequestSchema,
  fileSearchRequestSchema,
  fileWriteRequestSchema,
} from './schema.js'

const fileService = new FileService()

export interface FileController extends BaseController {
  read(c: Context): Promise<Response>
  write(c: Context): Promise<Response>
  remove(c: Context): Promise<Response>
  createDirectory(c: Context): Promise<Response>
  rename(c: Context): Promise<Response>
  browse(c: Context): Promise<Response>
  search(c: Context): Promise<Response>
}

export const fileController: FileController = {
  ...baseController,
  async read(c) {
    const { query } = await parseRequest(c, fileReadRequestSchema, 'fileController.read')
    const content = await fileService.readFile(query.path, c.get('traceId'))
    return baseController.ok(c, { path: query.path, content })
  },
  async write(c) {
    const { json } = await parseRequest(c, fileWriteRequestSchema, 'fileController.write')
    await fileService.writeFile(json.path, json.content, c.get('traceId'))
    return baseController.empty(c)
  },
  async remove(c) {
    const { query } = await parseRequest(c, fileRemoveRequestSchema, 'fileController.remove')
    await fileService.deleteFile(query.path, c.get('traceId'))
    return baseController.empty(c)
  },
  async createDirectory(c) {
    const { json } = await parseRequest(
      c,
      fileCreateDirectoryRequestSchema,
      'fileController.createDirectory',
    )
    await fileService.createDirectory(json.path, c.get('traceId'))
    return baseController.empty(c)
  },
  async rename(c) {
    const { json } = await parseRequest(c, fileRenameRequestSchema, 'fileController.rename')
    await fileService.renameFile(json.oldPath, json.newPath, c.get('traceId'))
    return baseController.empty(c)
  },
  async browse(c) {
    const { query } = await parseRequest(c, fileBrowseRequestSchema, 'fileController.browse')
    const entries = await fileService.browseDirs(query.path, c.get('traceId'))
    const folders = entries.filter((entry) => entry.type === 'directory')

    return baseController.ok(c, { path: query.path, folders })
  },
  async search(c) {
    const { query } = await parseRequest(c, fileSearchRequestSchema, 'fileController.search')
    const results = await fileService.searchFiles(query.project, query.q, c.get('traceId'))
    return baseController.ok(c, results)
  },
}
