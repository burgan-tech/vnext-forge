import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts';
import {
  assertCapabilityAllowed,
  filesSearchParams,
  type MethodRegistry,
  type ServiceRegistry,
} from '@vnext-forge-studio/services-core';
import type { FileSearchHit } from '@vnext-forge-studio/services-core/types';
import type { Hono } from 'hono';
import { ZodError } from 'zod';

import { config, isLoopbackHost } from '../../shared/config/config.js';
import { getRequestLogger } from '../../shared/lib/logger.js';
import type { Variables } from '../../shared/types/hono.js';
import { createDispatchHelper } from './lib/dispatch-helper.js';

function formatSseIssues(error: ZodError): { path: string; message: string; code: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

export function registerFilesRoutes(
  app: Hono<{ Variables: Variables }>,
  deps: { registry: MethodRegistry; services: ServiceRegistry },
): void {
  const helper = createDispatchHelper(deps);
  const trusted = isLoopbackHost(config.host);

  app.get('/files/read', (c) => helper(c, 'files/read', { source: 'query' }));
  app.put('/files/write', (c) => helper(c, 'files/write', { source: 'json' }));
  app.delete('/files/delete', (c) => helper(c, 'files/delete', { source: 'query' }));
  app.post('/files/mkdir', (c) => helper(c, 'files/mkdir', { source: 'json' }));
  app.post('/files/rename', (c) => helper(c, 'files/rename', { source: 'json' }));
  app.get('/files/browse', (c) => helper(c, 'files/browse', { source: 'query' }));
  app.post('/files/search', (c) => helper(c, 'files/search', { source: 'json' }));

  app.post('/files/search/stream', async (c) => {
    const traceId = c.get('traceId');
    const logger = getRequestLogger(c, 'files.searchStream');
    const origin = c.req.header('origin') ?? null;

    assertCapabilityAllowed(
      'files/search/stream',
      {
        trusted,
        origin,
        allowedOrigins: config.corsAllowedOrigins,
      },
      traceId,
    );

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'Request body must be valid JSON.',
        { source: 'files.routes.searchStream', layer: 'transport' },
        traceId,
      );
    }

    rawBody ??= {};

    let params: ReturnType<(typeof filesSearchParams)['parse']>;
    try {
      params = filesSearchParams.parse(rawBody);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new VnextForgeError(
          ERROR_CODES.API_BAD_REQUEST,
          'Request validation failed',
          {
            source: 'files.routes.searchStream',
            layer: 'application',
            details: { method: 'files/search/stream', issues: formatSseIssues(error) },
          },
          traceId,
        );
      }
      throw error;
    }

    const rootPath =
      params.projectId && params.projectId.length > 0
        ? (await deps.services.projectService.getProject(params.projectId, traceId)).path
        : params.projectPath;

    const controller = new AbortController();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: async (sink) => {
        const enqueue = (event: string, data: Record<string, unknown>) => {
          sink.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const totals = await deps.services.workspaceService.streamSearchFiles(
            rootPath,
            params.query,
            {
              caseSensitive: params.caseSensitive,
              wholeWord: params.wholeWord,
              useRegex: params.useRegex,
              includePatterns: params.includePatterns,
              excludePatterns: params.excludePatterns,
              limit: params.limit,
              cursor: params.cursor,
            },
            {
              onMatch: (hit: FileSearchHit) => {
                enqueue('match', {
                  path: hit.path,
                  line: hit.line,
                  column: hit.column,
                  text: hit.text,
                  matchLength: hit.matchLength,
                });
              },
              onProgress: (scannedFiles: number) => {
                enqueue('progress', { scannedFiles });
              },
            },
            controller.signal,
            traceId,
          );

          enqueue('done', {
            totalFiles: totals.totalFiles,
            totalMatches: totals.totalMatches,
            truncated: totals.truncated,
          });
        } catch (err) {
          if (err instanceof VnextForgeError) {
            const user = err.toUserMessage();
            enqueue('error', { message: user.message });
          } else {
            logger.error({ err }, 'files/search/stream failed');
            enqueue('error', { message: 'Search failed.' });
          }
        } finally {
          sink.close();
        }
      },
      cancel: () => controller.abort(),
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });
}
