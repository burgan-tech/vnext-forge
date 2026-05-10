import { z } from 'zod'

/**
 * Snippets Library — file-based code snippets shared across the app.
 *
 * Two scopes:
 *   - `personal` — `~/.vnext-studio/snippets/<id>.json` (per-machine, private)
 *   - `project`  — `<project>/.vnextstudio/snippets/<id>.json` (Git-tracked,
 *                   shared with the team)
 *
 * Format is intentionally close to VS Code's snippet schema so a future
 * import/export converter is a one-pager. Each file holds exactly one
 * snippet so deletes/renames map cleanly to filesystem ops.
 */

export const snippetScopeSchema = z.enum(['personal', 'project'])

export type SnippetScope = z.infer<typeof snippetScopeSchema>

export const snippetLanguageSchema = z.enum([
  'csx',
  'json',
  'plaintext',
])

export type SnippetLanguage = z.infer<typeof snippetLanguageSchema>

/**
 * On-disk shape. `id` is derived from the filename so we never carry it in
 * the JSON itself.
 */
export const snippetFileSchema = z.object({
  name: z.string().min(1, 'Snippet name is required'),
  prefix: z.string().min(1, 'Snippet prefix is required'),
  language: snippetLanguageSchema.default('plaintext'),
  description: z.string().optional(),
  /** VS Code-style snippet body lines. Tab-stops use `${1:placeholder}`. */
  body: z.array(z.string()),
  tags: z.array(z.string()).optional(),
})

export type SnippetFile = z.infer<typeof snippetFileSchema>

/**
 * Wire shape for list/get responses. Adds the runtime-only fields the UI
 * needs (id, scope, sourcePath) on top of the on-disk data.
 */
export const snippetSchema = snippetFileSchema.extend({
  id: z.string().min(1),
  scope: snippetScopeSchema,
  sourcePath: z.string().min(1),
})

export type Snippet = z.infer<typeof snippetSchema>

// ── list ─────────────────────────────────────────────────────────────────────

export const snippetsListAllParams = z.object({
  /** Optional project id. When omitted only personal snippets are returned. */
  projectId: z.string().min(1).optional(),
})

export const snippetsListAllResult = z.object({
  personal: z.array(snippetSchema),
  project: z.array(snippetSchema),
  /** File paths that failed to parse (malformed JSON, etc.). */
  warnings: z.array(z.string()),
})

export type SnippetsListAllParams = z.infer<typeof snippetsListAllParams>
export type SnippetsListAllResult = z.infer<typeof snippetsListAllResult>

// ── get ──────────────────────────────────────────────────────────────────────

export const snippetsGetOneParams = z.object({
  scope: snippetScopeSchema,
  id: z.string().min(1),
  projectId: z.string().min(1).optional(),
})

export const snippetsGetOneResult = z.object({
  snippet: snippetSchema,
})

export type SnippetsGetOneParams = z.infer<typeof snippetsGetOneParams>
export type SnippetsGetOneResult = z.infer<typeof snippetsGetOneResult>

// ── save (create or update) ──────────────────────────────────────────────────

export const snippetsSaveParams = z.object({
  scope: snippetScopeSchema,
  /**
   * Existing id (rename if changed) — null/undefined means create.
   * IDs come from the filename, so the server enforces a slug-safe value
   * derived from `name` when no `id` is provided.
   */
  id: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  data: snippetFileSchema,
})

export const snippetsSaveResult = z.object({
  snippet: snippetSchema,
  created: z.boolean(),
})

export type SnippetsSaveParams = z.infer<typeof snippetsSaveParams>
export type SnippetsSaveResult = z.infer<typeof snippetsSaveResult>

// ── delete ───────────────────────────────────────────────────────────────────

export const snippetsDeleteParams = z.object({
  scope: snippetScopeSchema,
  id: z.string().min(1),
  projectId: z.string().min(1).optional(),
})

export const snippetsDeleteResult = z.object({
  deleted: z.boolean(),
})

export type SnippetsDeleteParams = z.infer<typeof snippetsDeleteParams>
export type SnippetsDeleteResult = z.infer<typeof snippetsDeleteResult>

// ── openLocation (reveal in OS file manager) ─────────────────────────────────

export const snippetsOpenLocationParams = z.object({
  scope: snippetScopeSchema,
  id: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
})

export const snippetsOpenLocationResult = z.object({
  path: z.string(),
})

export type SnippetsOpenLocationParams = z.infer<typeof snippetsOpenLocationParams>
export type SnippetsOpenLocationResult = z.infer<typeof snippetsOpenLocationResult>
