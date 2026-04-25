import type { VnextComponentType } from '../shared/projectTypes.js';

export type VnextComponentJsonKind = VnextComponentType;

export interface VnextComponentJsonParams {
  key: string;
  domain: string;
  version?: string;
  flowVersion?: string;
}

/**
 * Minimal vNext component JSON for each kind. Shapes are validated against
 * @burgan-tech/vnext-schema (see vnextComponentTemplates.vitest.test.ts).
 */
export function buildVnextComponentJson(
  kind: VnextComponentJsonKind,
  params: VnextComponentJsonParams,
): Record<string, unknown> {
  const { key, domain, version = '1.0.0', flowVersion = '1.0.0' } = params;
  const defaultTag = key;

  switch (kind) {
    case 'workflow':
      return {
        key,
        domain,
        version,
        flow: 'sys-flows',
        flowVersion,
        tags: [defaultTag],
        attributes: {
          type: 'F',
          labels: [{ label: key, language: 'en' }],
          startTransition: {
            key: 'start',
            target: 'init',
            triggerType: 0,
            versionStrategy: 'Minor',
            labels: [{ label: 'Start', language: 'en' }],
          },
          states: [
            {
              key: 'init',
              stateType: 1,
              versionStrategy: 'Major',
              labels: [{ label: 'Initial', language: 'en' }],
            },
          ],
          functions: [] as unknown[],
          features: [] as unknown[],
          extensions: [] as unknown[],
        },
      };
    case 'task':
      return {
        key,
        domain,
        version,
        flow: 'sys-tasks',
        flowVersion,
        tags: [defaultTag],
        attributes: {
          type: '7',
          config: {} as Record<string, unknown>,
        },
      };
    case 'schema':
      return {
        key,
        domain,
        version,
        flow: 'sys-schemas',
        flowVersion,
        tags: [defaultTag],
        attributes: {
          type: 'schema',
          schema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $id: `https://${domain}/schemas/${key}`,
            title: key,
            type: 'object',
            additionalProperties: false,
            properties: {} as Record<string, unknown>,
          },
        },
      };
    case 'view':
      return {
        key,
        domain,
        version,
        flow: 'sys-views',
        flowVersion,
        tags: [defaultTag],
        attributes: {
          type: 1,
          labels: [
            { label: key, language: 'tr-TR' },
            { label: key, language: 'en-US' },
          ],
          display: 'full-page',
          content: '{}',
        },
      };
    case 'function':
      return {
        key,
        domain,
        version,
        flow: 'sys-functions',
        flowVersion,
        tags: [defaultTag],
        attributes: {
          scope: 'F',
          task: {
            order: 1,
            task: {
              key: 'placeholder-task',
              domain,
              flow: 'sys-tasks',
              version: '1.0.0',
            },
            mapping: {
              type: 'L',
              code: '//',
            },
          },
        },
      };
    case 'extension':
      return {
        key,
        domain,
        version,
        flow: 'sys-extensions',
        flowVersion,
        tags: [defaultTag],
        attributes: {
          type: 1,
          scope: 1,
          task: {
            order: 1,
            task: {
              key: 'placeholder-task',
              domain,
              flow: 'sys-tasks',
              version: '1.0.0',
            },
            mapping: {
              type: 'L',
              code: '//',
            },
          },
        },
      };
    default: {
      const k: string = String(kind);
      throw new Error(`Unknown vNext component kind: ${k}`);
    }
  }
}
