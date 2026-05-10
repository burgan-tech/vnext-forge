import { z } from 'zod';

/**
 * Param / result schemas for the four `quickrun-presets/*` registry methods.
 *
 * Presets are named, reusable QuickRun start-payloads — saved per workflow
 * so a developer can iterate "happy path", "blacklisted user", "missing
 * subject" scenarios without retyping. Stored on disk as
 * `<userData>/quickrun-presets/<projectId>/<workflowKey>/<slug>.json`.
 *
 * The user-supplied `name` is preserved verbatim (display label); the
 * filename uses a slug-safe transform to keep the path filesystem-safe.
 */

export const presetEntrySchema = z.object({
  /** Slug-safe id; matches the filename without `.json`. */
  id: z.string().min(1),
  /** Display label shown in the dropdown — preserved verbatim. */
  name: z.string().min(1),
  /** Optional one-liner — appears as a tooltip in the dropdown. */
  description: z.string().optional(),
  /** The actual QuickRun start payload (any JSON value). */
  payload: z.unknown(),
  /** ISO timestamps so the UI can sort recents-first. */
  createdAt: z.string(),
  lastUsedAt: z.string().optional(),
});
export type PresetEntry = z.infer<typeof presetEntrySchema>;

// ── list ───────────────────────────────────────────────────────────────────

export const presetsListParamsSchema = z.object({
  projectId: z.string().min(1),
  workflowKey: z.string().min(1),
});
export type PresetsListParams = z.infer<typeof presetsListParamsSchema>;

export const presetsListResultSchema = z.object({
  presets: z.array(presetEntrySchema),
});
export type PresetsListResult = z.infer<typeof presetsListResultSchema>;

// ── get ────────────────────────────────────────────────────────────────────

export const presetsGetParamsSchema = z.object({
  projectId: z.string().min(1),
  workflowKey: z.string().min(1),
  presetId: z.string().min(1),
});
export type PresetsGetParams = z.infer<typeof presetsGetParamsSchema>;

export const presetsGetResultSchema = z.object({
  preset: presetEntrySchema.nullable(),
});
export type PresetsGetResult = z.infer<typeof presetsGetResultSchema>;

// ── save ───────────────────────────────────────────────────────────────────

/**
 * Save a preset. When `presetId` is provided we update in-place (overwrite
 * the file at that slug); when absent we derive a slug from `name` and
 * append a numeric suffix on collision so two "Untitled" drafts coexist.
 */
export const presetsSaveParamsSchema = z.object({
  projectId: z.string().min(1),
  workflowKey: z.string().min(1),
  presetId: z.string().min(1).optional(),
  data: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    payload: z.unknown(),
  }),
});
export type PresetsSaveParams = z.infer<typeof presetsSaveParamsSchema>;

export const presetsSaveResultSchema = z.object({
  preset: presetEntrySchema,
  /** True when the saved file is brand new (vs. an in-place update). */
  created: z.boolean(),
});
export type PresetsSaveResult = z.infer<typeof presetsSaveResultSchema>;

// ── delete ─────────────────────────────────────────────────────────────────

export const presetsDeleteParamsSchema = z.object({
  projectId: z.string().min(1),
  workflowKey: z.string().min(1),
  presetId: z.string().min(1),
});
export type PresetsDeleteParams = z.infer<typeof presetsDeleteParamsSchema>;

export const presetsDeleteResultSchema = z.object({
  deleted: z.boolean(),
});
export type PresetsDeleteResult = z.infer<typeof presetsDeleteResultSchema>;
