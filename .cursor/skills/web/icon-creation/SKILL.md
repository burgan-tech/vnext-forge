---
name: icon-creation
description: Scope is packages/designer-ui (component-type icon source of truth) plus the file-tree consumers in apps/web and apps/extension/webview-ui. Guidelines for creating and maintaining vNext component-type icons (folder, file, vnext.config) rendered as inline-SVG React components. Use when adding a new component type, modifying badge symbol/color/position, changing the folder/file outline, or wiring a new consumer to these icons.
---

# vNext Component Icon Creation

> **Scope:**
> - **Source of truth:** `packages/designer-ui/src/ui/icons/` (the icons themselves).
> - **Consumers:** `apps/web` (file tree) and `apps/extension/webview-ui` (VS Code webview file tree / future shells).
>
> Icons live in `designer-ui` so every shell (web, VS Code webview, future editors) shares one set. Do **not** add a new copy under `apps/*`.

## Architecture

vNext component-type icons are **inline SVG React components**, not `<img>` tags or files served from `public/`. This is required so:

- The folder outline can inherit `currentColor` from Tailwind `text-*-icon` classes (theme-adaptive).
- The icon ships with the JS bundle and works inside the VS Code webview, where `/folder_icons/*` is **not** served.

The legacy `apps/web/src/modules/project-workspace/ComponentFolderIcon.tsx`, `componentFolderIcons.ts` and `apps/web/public/folder_icons/<type>/*.svg` files have been removed. All new work happens in `designer-ui`.

### Key Files

| File | Role |
|------|------|
| `packages/designer-ui/src/ui/icons/ComponentFolderIcon.tsx` | Inline SVG for component folders (closed/open + colored badge). |
| `packages/designer-ui/src/ui/icons/ComponentFileIcon.tsx` | Inline SVG for component JSON files (file outline + colored badge). |
| `packages/designer-ui/src/ui/icons/VnextConfigFileIcon.tsx` | Inline SVG for `vnext.config.json`. |
| `packages/designer-ui/src/ui/icons/componentFolderTypes.ts` | `ComponentFolderType` union (folder-level, plural names). |
| `packages/designer-ui/src/shared/projectTypes.ts` | `VnextComponentType` union (file-level, singular names). |
| `packages/designer-ui/src/ui/icons/index.ts` | Barrel export — every consumer imports from `@vnext-forge/designer-ui`. |
| `apps/web/src/modules/project-workspace/FileTree.tsx` | `detectComponentFolderType(...)` maps a file-tree path to a `ComponentFolderType`. |
| `apps/web/src/modules/project-workspace/FileTreeNodeRow.tsx` | Consumer: renders `<ComponentFolderIcon>`, `<ComponentFileIcon>`, `<VnextConfigFileIcon>`. |
| `apps/web/src/app/store/useComponentFileTypesStore.ts` | Maps a `.json` file path → `VnextComponentType` (drives `<ComponentFileIcon>`). |

### Type Naming — Folder vs File

Folder icons and file icons use **different unions** on purpose:

- `ComponentFolderType` — plural names (containers): `workflows | tasks | schemas | views | functions | extensions | components_root`.
- `VnextComponentType` — singular names (the JSON file itself): `workflow | task | schema | view | function | extension`.

`components_root` only exists at folder level (the configurable root that holds all component folders); there is no "components_root" file icon.

### Rendering Flow

`FileTreeNodeRow` (in `apps/web`) decides which icon to render:

- **Folder row:** if `componentFolderType` is set → `<ComponentFolderIcon type expanded className="size-3.5 shrink-0 ..." />`. Otherwise lucide `Folder` / `FolderOpen`.
- **File row:** if the file is `vnext.config.json` → `<VnextConfigFileIcon />`. Else if `useComponentFileType(...)` returns a `VnextComponentType` → `<ComponentFileIcon type />`. Otherwise the generic 2-letter file tone badge from `getFileTone`.

Closed folders are rendered with `text-muted-icon`, open folders with `text-secondary-icon`. The colored badge inside the folder is set by the icon component itself (not by the consumer).

## Design Rules

### 1. Folder/File Outline — Use Lucide's Exact Paths

Every icon is a 24×24 SVG. Use lucide's real `d` attributes; do not redraw the folder or file shape.

Closed folder:
```
M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z
```

Open folder:
```
m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2
```

File outline (top + fold):
```
M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z
M14 2v4a1 1 0 0 0 1 1h4
```

Outline attributes: `fill="none"`, `stroke="currentColor"`. Folders use `strokeWidth="2"`, files use `strokeWidth="1.5"`. Both use `strokeLinecap="round"` and `strokeLinejoin="round"`.

### 2. Badge Position

- **Folder badge:** bottom-right of the folder body. Use `<g transform="translate(X,Y) scale(S)">` with translate around `(8–9, 7–8)`. Do not center the badge in the folder.
- **File badge:** lower-middle of the file body, below the corner fold. Translate around `(7.5–9, 9.5–10)`.

### 3. Badge Size — Visible at Render Size

- Folder icons render at `size-3.5` (14px) → folder badges use scale `0.55–0.60`.
- File icons render at `size-4` (16px) → file badges use scale `0.50–0.55`.
- Line-only symbols (`< >`, `{ }`) need a thicker stroke (`3.2`) than shape-based symbols (`2.5–2.8`) because they have less visual weight.

| Badge complexity | Folder scale | File scale | Stroke width |
|---|---|---|---|
| Line-only (`< >`, `{ }`) | `0.60` | `0.55` | `3.2` |
| Shape-based (workflow boxes, eye, blocks, check, hierarchy) | `0.55–0.58` | `0.50–0.52` | `2.5` (folder) / `2.8` (file) |

### 4. Badge Colors — Maximum Hue Separation

Each component type uses one color used by **both** its folder badge and its file badge. Users must identify the component type by color alone.

| Component | Color | Hue | Lucide source icon |
|---|---|---|---|
| Workflows / workflow | `#a78bfa` | Violet | Workflow (two connected boxes) |
| Tasks / task | `#f97316` | Orange | CodeXml `< >` (angle brackets) |
| Schemas / schema | `#06b6d4` | Cyan | CircleCheckBig (circle + checkmark) |
| Views / view | `#22c55e` | Green | Eye (eye + pupil) |
| Functions / function | `#3b82f6` | Blue | Braces `{ }` |
| Extensions / extension | `#f43f5e` | Rose / Red | Blocks (L-shaped connected blocks) |
| Components root (folder only) | `#8b5cf6` | Violet (deeper) | Box hierarchy (3 stacked layers) |
| `vnext.config.json` (file only) | `#9333ea` | Purple | Settings (gear + center circle) |

When adding a new type, pick a hue that is maximally distant from existing ones on the color wheel.

### 5. Badge Fill

- Default: `fill="none"` (stroke-only badges).
- Exception: a small low-opacity fill is acceptable on solid icons (e.g. `fill={color} fillOpacity="0.2"`).
- Never use opaque fills on badges.
- Never add `fill` or `fillOpacity` to the **outline** path — the folder/file shape must stay `fill="none"` so it inherits `currentColor` from the consumer's Tailwind class.

### 6. No Extra Labels

Do **not** add uppercase text labels (like "EXTENSIONS") next to folder/file names. The icon + color is enough.

## Adding a New Component Type

When introducing a new vNext component type (e.g. a new "policies" type), apply the change in this exact order:

1. **Type unions** (in `packages/designer-ui`):
   - Add the singular name to `VnextComponentType` in `src/shared/projectTypes.ts` (e.g. `'policy'`).
   - Add the plural name to `ComponentFolderType` in `src/ui/icons/componentFolderTypes.ts` (e.g. `'policies'`).
2. **Folder icon**: add a `BADGE_CONFIGS` entry in `ComponentFolderIcon.tsx`:
   - Choose a lucide icon that semantically represents the component.
   - Pick a color with maximum hue distance from existing colors.
   - Position the badge at bottom-right with the appropriate scale.
3. **File icon**: add a matching `BADGE_CONFIGS` entry in `ComponentFileIcon.tsx` using the **same color** as the folder badge.
4. **Detection / mapping (consumer side, in `apps/web`):**
   - Update `detectComponentFolderType(...)` and the `componentDirs` plumbing in `FileTree.tsx` if the new folder needs custom matching beyond the default directory-name lookup.
   - Update `useComponentFileTypesStore` so JSON files in the new folder are tagged with the new `VnextComponentType`.
5. **Build/lint:** run `npm run lint` and the relevant package build to make sure both `designer-ui` and `apps/web` (and the extension webview) still type-check against the widened unions.

There is **no** need to add `public/folder_icons/<type>/*.svg` files anymore — the icons ship inline with the bundle.

## Common Mistakes

- Adding a new icon under `apps/web/src/modules/project-workspace/` instead of in `packages/designer-ui/src/ui/icons/`. Icons must stay shared so the VS Code webview gets the same set.
- Using `<img src="/folder_icons/...svg">` to render an icon — `currentColor` won't work and the asset isn't served inside the VS Code webview.
- Centering the folder badge in the folder body instead of bottom-right.
- Using similar hues for different components (e.g. blue and cyan without enough separation).
- Making line-only badges (`< >`, `{ }`) too thin so they disappear at 14px / 16px.
- Adding `fill` or `fillOpacity` to the folder/file outline path — outlines must stay `fill="none"` and stroke-only so they follow `currentColor`.
- Hardcoding gray on the outline `stroke` instead of using `stroke="currentColor"` and letting the consumer pick `text-*-icon`.
- Using a folder-style plural name (`workflows`) for a file icon, or a singular name (`workflow`) for a folder icon — `ComponentFolderType` and `VnextComponentType` are deliberately separate unions.
