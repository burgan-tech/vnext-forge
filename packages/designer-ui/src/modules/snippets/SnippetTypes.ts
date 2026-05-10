/**
 * Local mirror of the snippet contract from
 * `packages/services-core/src/services/snippets/snippets-schemas.ts`. designer-ui
 * never imports services-core directly (browser bundle / Node split), so we
 * duplicate the small shape here. Keep both files in sync — Zod schemas are
 * the source of truth, this file is a static type mirror.
 */

export type SnippetScope = 'personal' | 'project';

export type SnippetLanguage = 'csx' | 'json' | 'plaintext';

export interface SnippetFile {
  name: string;
  prefix: string;
  language: SnippetLanguage;
  description?: string;
  body: string[];
  tags?: string[];
}

export interface Snippet extends SnippetFile {
  id: string;
  scope: SnippetScope;
  sourcePath: string;
}

export interface SnippetsListAllResult {
  personal: Snippet[];
  project: Snippet[];
  warnings: string[];
}

export interface SnippetsSaveResult {
  snippet: Snippet;
  created: boolean;
}
