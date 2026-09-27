export type SupportedCategory = 'schemas' | 'views' | 'extensions' | 'functions';

export interface NewComponentTemplateOptions {
  /** `attributes.type` of a new schema; defaults to `workflow` (previous behaviour). */
  schemaType?: string;
}

export interface NewComponentCategoryMeta {
  singular: string;
  flow: string;
  template: (key: string, domain: string, options?: NewComponentTemplateOptions) => Record<string, unknown>;
}

/** Minimal documents written by `CreateNewComponentDialog`, per category. */
export const CREATE_NEW_COMPONENT_META: Record<SupportedCategory, NewComponentCategoryMeta> = {
  schemas: {
    singular: 'schema',
    flow: 'sys-schemas',
    template: (key, domain, options) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-schemas',
      flowVersion: '1.0.0',
      tags: [domain, 'sys-schemas'],
      attributes: {
        type: options?.schemaType ?? 'workflow',
        schema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $id: `urn:vnext:${key}`,
          title: key,
          type: 'object',
        },
      },
    }),
  },
  views: {
    singular: 'view',
    flow: 'sys-views',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-views',
      flowVersion: '1.0.0',
      tags: [domain, 'sys-views'],
      attributes: {
        type: 1,
        display: 'full-page',
        content: {},
      },
    }),
  },
  extensions: {
    singular: 'extension',
    flow: 'sys-extensions',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-extensions',
      flowVersion: '1.0.0',
      tags: [domain, 'sys-extensions'],
      attributes: {
        type: 1,
        scope: 1,
        task: {
          order: 1,
          task: { key: 'placeholder', domain, flow: 'sys-tasks', version: '1.0.0' },
          mapping: { location: './src/Mapping.csx', code: 'Ly8=' },
        },
      },
    }),
  },
  functions: {
    singular: 'function',
    flow: 'sys-functions',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-functions',
      flowVersion: '1.0.0',
      tags: [domain, 'sys-functions'],
      attributes: {
        scope: 'I',
        task: {
          order: 1,
          task: { key: 'placeholder', domain, flow: 'sys-tasks', version: '1.0.0' },
          mapping: { location: './src/Mapping.csx', code: 'Ly8=' },
        },
      },
    }),
  },
};
