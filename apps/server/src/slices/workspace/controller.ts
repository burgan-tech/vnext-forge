import path from 'node:path';
import { platform } from 'node:os';
import type { Context } from 'hono';
import { getRequestLogger } from '@shared/lib/logger.js';
import { parseRequest } from '@shared/lib/request.js';
import { ok, empty } from '@shared/lib/response-helpers.js';
import { WorkspaceService } from './service.js';
import {
  fileBrowseRequestSchema,
  fileCreateDirectoryRequestSchema,
  fileReadRequestSchema,
  fileRemoveRequestSchema,
  fileRenameRequestSchema,
  fileSearchRequestSchema,
  fileWriteRequestSchema,
} from './schema.js';

const workspaceService = new WorkspaceService();
const SYSTEM_ROOT_TOKEN = '::system-root::';

export const workspaceController = {
  async read(c: Context): Promise<Response> {
    const { query } = await parseRequest(c, fileReadRequestSchema, 'workspaceController.read');
    const content = await workspaceService.readFile(query.path, c.get('traceId'));
    return ok(c, { path: query.path, content });
  },

  async write(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'workspaceController.write');
    const { json } = await parseRequest(c, fileWriteRequestSchema, 'workspaceController.write');
    logger.info({ path: json.path }, 'writing file');
    await workspaceService.writeFile(json.path, json.content, c.get('traceId'));
    return empty(c);
  },

  async remove(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'workspaceController.remove');
    const { query } = await parseRequest(c, fileRemoveRequestSchema, 'workspaceController.remove');
    logger.info({ path: query.path }, 'deleting file');
    await workspaceService.deleteFile(query.path, c.get('traceId'));
    return empty(c);
  },

  async createDirectory(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'workspaceController.createDirectory');
    const { json } = await parseRequest(
      c,
      fileCreateDirectoryRequestSchema,
      'workspaceController.createDirectory',
    );
    logger.info({ path: json.path }, 'creating directory');
    await workspaceService.createDirectory(json.path, c.get('traceId'));
    return empty(c);
  },

  async rename(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'workspaceController.rename');
    const { json } = await parseRequest(c, fileRenameRequestSchema, 'workspaceController.rename');
    logger.info({ oldPath: json.oldPath, newPath: json.newPath }, 'renaming file');
    await workspaceService.renameFile(json.oldPath, json.newPath, c.get('traceId'));
    return empty(c);
  },

  async browse(c: Context): Promise<Response> {
    const { query } = await parseRequest(c, fileBrowseRequestSchema, 'workspaceController.browse');
    const entries = await workspaceService.browseDirs(query.path, c.get('traceId'));
    const folders = entries.filter((entry) => entry.type === 'directory');
    const responsePath =
      query.path === SYSTEM_ROOT_TOKEN
        ? platform() === 'win32'
          ? ''
          : path.parse(process.cwd()).root
        : query.path;

    return ok(c, { path: responsePath, folders });
  },

  async search(c: Context): Promise<Response> {
    const logger = getRequestLogger(c, 'workspaceController.search');
    const { query } = await parseRequest(c, fileSearchRequestSchema, 'workspaceController.search');
    logger.info({ projectPath: query.project, query: query.q }, 'searching files');
    const results = await workspaceService.searchFiles(query.project, query.q, c.get('traceId'));
    return ok(c, results);
  },
};
