---
name: icon-creation
description: Guidelines for creating and maintaining component folder icons in the FileTree sidebar. Use when adding new component types, modifying existing folder icons, changing badge symbols or colors, or working with the ComponentFolderIcon system.
---

# Component Folder Icon Creation

## Architecture

Component folder icons are rendered as **inline SVG React components**, not `<img>` tags. This enables `currentColor` inheritance from Tailwind CSS classes, ensuring icons adapt to the active theme.

### Key Files

| File | Role |
|------|------|
| `modules/project-workspace/ComponentFolderIcon.tsx` | Inline SVG renderer (source of truth for runtime) |
| `modules/project-workspace/componentFolderIcons.ts` | Type definitions and public SVG path metadata |
| `modules/project-workspace/FileTreeNodeRow.tsx` | Consumes `ComponentFolderIcon` in the tree row |
| `public/folder_icons/<type>/closed_folder.svg` | Static SVG reference files (design assets) |
| `public/folder_icons/<type>/open_folder.svg` | Static SVG reference files (design assets) |

### Rendering Flow

`FileTreeNodeRow` checks `componentFolderType` prop:
- If set → renders `<ComponentFolderIcon>` with `currentColor` + theme class
- If not → falls back to lucide `Folder` / `FolderOpen`

Closed folders use `text-muted-icon`, open folders use `text-secondary-icon`.

## Design Rules

### 1. Folder Base — Use Lucide's Exact Paths

Every icon is a 24×24 SVG with lucide's real folder `d` attribute. Do NOT create custom folder shapes.

```
Closed: M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z
Open:   m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2
```

Folder attributes: `fill="none"`, `stroke="currentColor"`, `strokeWidth="2"`.

### 2. Badge Position — Bottom-Right

Badges sit in the **bottom-right** area of the folder body, not centered. Use `<g transform="translate(X,Y) scale(S)">` where:

- Typical translate: `(8–9, 7–8)` — shifts badge toward bottom-right
- Never center the badge in the folder (`translate(5,6)` is wrong)

### 3. Badge Size — Large and Visible

Badges must be clearly distinguishable at the rendered icon size of `size-3.5` (14px).

| Badge complexity | Scale | StrokeWidth |
|---|---|---|
| Line-only symbols (`< >`, `{ }`) | `0.60` | `3.2` (thicker for visibility) |
| Shape-based symbols (workflow boxes, blocks, eye) | `0.55–0.58` | `2.5` |

Line-only symbols need extra thickness because they have less visual weight than shapes.

### 4. Badge Colors — Maximum Hue Separation

Each component type uses a unique color from a different hue segment. Users must identify the component by color alone.

| Component | Color | Hue | Lucide source icon |
|---|---|---|---|
| Workflows | `#a78bfa` | Violet | Workflow (two connected boxes) |
| Tasks | `#f97316` | Orange | CodeXml `< >` (angle brackets, no slash) |
| Schemas | `#06b6d4` | Cyan | CircleCheckBig (circle + checkmark) |
| Views | `#22c55e` | Green | Eye (eye + pupil) |
| Functions | `#3b82f6` | Blue | Braces `{ }` (curly braces) |
| Extensions | `#f43f5e` | Rose/Red | Blocks (L-shaped connected blocks) |

When adding a new type, pick a hue that is maximally distant from existing ones on the color wheel.

### 5. Badge Fill

- Default: `fill="none"` (stroke-only badges)
- Exception: small fills with low opacity are acceptable for solid icons (e.g. `fill={color} fillOpacity="0.2"`)
- Never use opaque fills on badges

### 6. No Extra Labels

Do NOT add uppercase text labels (like "EXTENSIONS") next to folder names. The icon + color is sufficient for identification.

## Adding a New Component Type

1. Add the type to `ComponentFolderType` union in `componentFolderIcons.ts`
2. Add a `BadgeConfig` entry in `ComponentFolderIcon.tsx`:
   - Choose a lucide icon that semantically represents the component
   - Pick a color with maximum hue distance from existing colors
   - Position badge at bottom-right with appropriate scale
3. Add SVG reference files at `public/folder_icons/<type>/closed_folder.svg` and `open_folder.svg`
4. Add metadata to `COMPONENT_FOLDER_META` in `componentFolderIcons.ts`
5. Update `detectComponentFolderType` in `FileTree.tsx` if detection logic needs changes

## Common Mistakes

- Using `<img>` tags to render SVGs — `currentColor` won't work, breaks theme adaptation
- Centering the badge in the folder body instead of bottom-right
- Using similar hues for different components (e.g. blue and cyan without enough separation)
- Making line-only badges (`< >`, `{ }`) too thin — they disappear at 14px render size
- Adding `fill` or `fill-opacity` to the folder base path — folders must stay `fill="none"`
- Hardcoding gray colors on the folder stroke instead of using `currentColor`
