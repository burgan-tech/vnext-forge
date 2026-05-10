import { z } from 'zod'

/**
 * Smart Search (Cmd+P) — semantic index of all addressable vNext entries in
 * an open project: workflows, their states/transitions, tasks, schemas,
 * views, functions, extensions.
 *
 * The result is the full flat list — typically 100–500 entries per project.
 * The client (designer-ui) does fuzzy matching locally; the server only
 * builds and returns the index.
 */

export const quickSwitchEntryTypeSchema = z.enum([
  'workflow',
  'state',
  'transition',
  'task',
  'schema',
  'view',
  'function',
  'extension',
])

export type QuickSwitchEntryType = z.infer<typeof quickSwitchEntryTypeSchema>

export const quickSwitchEntrySchema = z.object({
  /** Stable identifier; safe to use as React key. */
  id: z.string().min(1),
  type: quickSwitchEntryTypeSchema,
  /** Primary display text — usually the entity's `key`. */
  label: z.string().min(1),
  /**
   * Secondary line shown beneath the label in the palette.
   * For nested entries (state/transition) carries the parent workflow key;
   * for workflows carries the workflow type letter (F/S/P/C); empty otherwise.
   */
  description: z.string().optional(),
  /** Top-level vNext entity key (for nested entries this is the workflow key). */
  componentKey: z.string().min(1),
  /** Owning domain — read from the JSON file. */
  domain: z.string().optional(),
  /** Component version, when present in the JSON. */
  version: z.string().optional(),
  /** vNext flow discriminator (sys-flows / sys-tasks / sys-schemas / etc.). */
  flow: z.string().min(1),
  /** Absolute POSIX path of the source JSON file. */
  filePath: z.string().min(1),
  /** Set when type === 'state' or type === 'transition' (transition's parent state). */
  stateKey: z.string().optional(),
  /** Set when type === 'transition'. */
  transitionKey: z.string().optional(),
})

export type QuickSwitchEntry = z.infer<typeof quickSwitchEntrySchema>

export const quickswitcherBuildIndexParams = z.object({
  /** Project id (same shape as `projects/getById` etc.). */
  id: z.string().min(1, 'Project id is required'),
})

export const quickswitcherBuildIndexResult = z.object({
  entries: z.array(quickSwitchEntrySchema),
  /**
   * Paths the indexer attempted to parse but couldn't (malformed JSON,
   * unreadable, etc.). Surfaced for diagnostics; the palette stays usable.
   */
  warnings: z.array(z.string()),
})

export type QuickswitcherBuildIndexParams = z.infer<typeof quickswitcherBuildIndexParams>
export type QuickswitcherBuildIndexResult = z.infer<typeof quickswitcherBuildIndexResult>
