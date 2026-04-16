# Extension Editor Redirect — Session Changes

**Date:** 2026-04-16  
**Status:** REVERTED — Extension files now open in Extension Editor again.

---

## Summary of all changes in this session

### 1. Extension → Code Editor redirect (REVERTED)

Extension JSON files were temporarily opening in the Code Editor (Monaco) for JSON schema validation testing. This has been **reverted** — extension files now open in the Extension Editor page again.

#### Reverted files

| File | Current state |
|------|-------------|
| `apps/web/src/app/routes/AppRouter.tsx` | `:id/extension/:group/:name` route renders `ExtensionEditorPage` (original). |
| `apps/web/src/modules/project-workspace/FileRouter.ts` | Extension branch returns `navigateTo` to `/project/:id/extension/...` (original). |

---

### 2. validate.js check moved from Code Editor mount to project open (KEEP)

Previously `CodeEditorPage` called `syncVnextWorkspaceFromDisk` on mount, which checked `validate.js` existence every time any file was opened in the code editor. This was unnecessary.

#### Changed files

| File | What changed |
|------|-------------|
| `apps/web/src/pages/code-editor/CodeEditorPage.tsx` | Removed `syncVnextWorkspaceFromDisk` call from the `useEffect` that fires on editor page mount. The editor still loads the active project if needed. |
| `apps/web/src/modules/project-workspace/syncVnextWorkspaceFromDisk.ts` | Extracted `refreshWorkspaceLayoutAndValidateScript()` as a standalone export. Both layout status and validate.js checks live here. `syncVnextWorkspaceFromDisk` calls it internally when config is ok. |
| `apps/web/src/modules/project-workspace/hooks/useProjectWorkspacePage.ts` | Replaced inline `offerLayoutSeedIfNeeded` with `refreshWorkspaceLayoutAndValidateScript` — runs on initial project workspace load. Removed `getVnextComponentLayoutStatus` direct import (no longer needed). Fixed `CreateLogger` → `createLogger` casing. |
| `apps/web/src/app/store/useProjectStore.ts` | `refreshFileTree` now calls `refreshWorkspaceLayoutAndValidateScript` after a successful tree fetch (when `vnextConfig` is present). This means deleting `validate.js` or a template folder and refreshing the tree will update StatusBar warnings. |

#### Trigger points for layout + validate.js check

| When | Via |
|------|-----|
| Project first opened (workspace page mount) | `useProjectWorkspacePage` → `refreshWorkspaceLayoutAndValidateScript` |
| File tree refreshed (file create/delete/rename) | `useProjectStore.refreshFileTree` → `refreshWorkspaceLayoutAndValidateScript` |
| `vnext.config.json` saved in code editor | `CodeEditorPage.handleSave` → `syncVnextWorkspaceFromDisk` → `refreshWorkspaceLayoutAndValidateScript` |
| Config wizard completed | `AppLayout.handleWizardCompleted` → `syncVnextWorkspaceFromDisk` |
| Manual recheck | `useVnextConfigStatusRecheck` → `syncVnextWorkspaceFromDisk` |

---

## Notes

- The `CreateLogger` → `createLogger` casing fix in `useProjectWorkspacePage.ts` was a pre-existing bug on Windows (tsc TS1149). This fix should be kept regardless.
- StatusBar messages for `validate.js` missing and template layout incomplete are still in Turkish; they should be migrated to English per the project's user-visible language rule.
