# `useAsync` call-site inventory (Wave 3 — R-f6)

Defaults are **not** flipped in this wave; this table classifies each consumer and suggests a future default policy per category.

| Location | Category | Notes | Suggested default policy (future) |
|----------|----------|-------|-----------------------------------|
| `apps/web/.../useProjectWorkspace.ts` (×5) | Workspace mutation | Single toast via `onError`; `showNotificationOnError: false` | `showNotificationOnError: false`; require explicit `onError` for user messaging |
| `apps/web/.../useWriteVnextWorkspaceConfig.ts` | Workspace mutation | Config save; toasts enabled in hook defaults | Same as above; callers pass only extra `onSuccess` / copy overrides |
| `packages/designer-ui/.../useSaveFile.ts` | Editor save | Logs on error; no auto toast | `showNotificationOnError: false` (keep); optional host toast from caller |
| `packages/designer-ui/.../useSaveComponent.ts` | Editor save | Success toast; error logged only | Align with `useSaveFile`: errors explicit at call site if needed |
| `packages/designer-ui/.../useFlowEditorPersistence.ts` | Editor save | No auto toasts; caller may surface `saveError` | Keep notifications opt-in |
| `packages/designer-ui/.../useSchemaEditor.ts` (load) | Passive query | Load on `filePath`; `showNotificationOnError: false` | Default off for loads; surface inline / empty state |
| `packages/designer-ui/.../useSchemaEditor.ts` (save) | Editor save | Success toast; error logged | Same as other editor saves |
| `packages/designer-ui/.../useFlowEditorDocument.ts` | Passive query | Load document; no success toast | Default off for loads |
| `packages/designer-ui/.../useTaskEditor.ts` | Passive query | Load task JSON | Default off for loads |
| `packages/designer-ui/.../useLoadComponent.ts` | Passive query | Load generic component | Default off for loads |
| `packages/designer-ui/.../UseFunctionEditor.ts` | Passive query | Load function | Default off for loads |
| `packages/designer-ui/.../useWorkflowValidation.ts` | One-shot / on-demand | Validation run | Keep errors visible in-panel; toasts optional |
| `packages/designer-ui/.../useRuntimeHealth.ts` | Passive query / poll | Runtime health check | Never spam toasts on poll failure; degraded UI only |

**Obvious follow-ups:** Ensure every workspace mutation path has exactly one notification owner (see R-f16). After changing defaults, re-check extension webview (native notifications) vs web (Sonner).
