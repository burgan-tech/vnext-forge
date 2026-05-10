import { z } from 'zod'

/**
 * Workspace Sessions — per-project snapshot of UI shell state, persisted as
 * `<project>/.vnextstudio/session.json` so a relaunch (or project re-open)
 * restores the user back to where they left off:
 *
 *   - open editor tabs + active tab
 *   - sidebar view + width + open/closed
 *   - active runtime connection id (when the runtime monitor lands later)
 *   - the last query each search palette saw, optional
 *
 * The schema is intentionally permissive: every field is optional and shapes
 * are loose. The store re-validates whatever it loaded against its own
 * runtime types before applying. A corrupted or stale file therefore never
 * blocks startup — at worst the affected slice falls back to defaults.
 */

export const sessionEditorTabSchema = z
  .object({
    id: z.string(),
    kind: z.string().optional(),
    title: z.string().optional(),
    filePath: z.string().optional(),
    language: z.string().optional(),
    componentKind: z.string().optional(),
    group: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough()

export const sessionEditorStateSchema = z.object({
  open: z.array(sessionEditorTabSchema).default([]),
  activeTabId: z.string().nullable().default(null),
})

export const sessionSidebarStateSchema = z.object({
  view: z.string().default('project'),
  open: z.boolean().default(true),
  width: z.number().default(230),
})

export const sessionRuntimeStateSchema = z.object({
  activeConnectionId: z.string().nullable().default(null),
})

export const sessionPaletteStateSchema = z.object({
  lastQuickSwitcherQuery: z.string().optional(),
  lastSearchQuery: z.string().optional(),
  lastSnippetQuery: z.string().optional(),
})

export const workspaceSessionSchema = z.object({
  version: z.literal(1).default(1),
  editor: sessionEditorStateSchema.default({ open: [], activeTabId: null }),
  sidebar: sessionSidebarStateSchema.default({
    view: 'project',
    open: true,
    width: 230,
  }),
  runtime: sessionRuntimeStateSchema.default({ activeConnectionId: null }),
  palette: sessionPaletteStateSchema.default({}),
  lastSavedAt: z.string().optional(),
})

export type WorkspaceSession = z.infer<typeof workspaceSessionSchema>

// ── get ──────────────────────────────────────────────────────────────────────

export const sessionsGetParams = z.object({
  projectId: z.string().min(1),
})

export const sessionsGetResult = z.object({
  /**
   * `null` when no session has ever been saved (or the file was deleted).
   * The client should treat `null` as "use defaults" — never as an error.
   */
  session: workspaceSessionSchema.nullable(),
})

export type SessionsGetParams = z.infer<typeof sessionsGetParams>
export type SessionsGetResult = z.infer<typeof sessionsGetResult>

// ── save ─────────────────────────────────────────────────────────────────────

export const sessionsSaveParams = z.object({
  projectId: z.string().min(1),
  /**
   * Full snapshot. The server overwrites the file; partial writes are not
   * supported — the renderer already has the full state in memory and a
   * one-shot replace keeps the on-disk shape predictable.
   */
  session: workspaceSessionSchema,
})

export const sessionsSaveResult = z.object({
  ok: z.literal(true),
  path: z.string(),
})

export type SessionsSaveParams = z.infer<typeof sessionsSaveParams>
export type SessionsSaveResult = z.infer<typeof sessionsSaveResult>

// ── clear ────────────────────────────────────────────────────────────────────

export const sessionsClearParams = z.object({
  projectId: z.string().min(1),
})

export const sessionsClearResult = z.object({
  cleared: z.boolean(),
})

export type SessionsClearParams = z.infer<typeof sessionsClearParams>
export type SessionsClearResult = z.infer<typeof sessionsClearResult>
